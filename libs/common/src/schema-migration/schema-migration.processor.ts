import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SCHEMA_MIGRATION_QUEUE } from '../constants';

@Injectable()
@Processor(SCHEMA_MIGRATION_QUEUE)
export class SchemaMigrationProcessor extends WorkerHost {
  private readonly logger = new Logger(SchemaMigrationProcessor.name);

  constructor(@InjectConnection() private readonly connection: Connection) {
    super();
  }

  async process(
    job: Job<{ modelName: string; field: string; defaultValue: any }>,
  ) {
    const { modelName, field, defaultValue } = job.data;
    this.logger.log(
      `[${job.id}] Migrating ${modelName}.${field} to default: ${defaultValue}`,
    );

    // Resolve model dynamically from connection
    const model = this.connection.models[modelName];
    if (!model) {
      throw new Error(`Model ${modelName} not found in connection models.`);
    }

    const BATCH_SIZE = 100;
    let processedCount = 0;

    const cursor = model.find({ [field]: { $exists: false } }).cursor();

    let batch: any[] = [];

    for await (const doc of cursor) {
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { [field]: defaultValue } },
        },
      });

      if (batch.length >= BATCH_SIZE) {
        await model.bulkWrite(batch);
        processedCount += batch.length;
        // this.logger.log(`[${job.id}] Processed ${processedCount}...`); // Optional debug
        batch = [];
      }
    }

    if (batch.length > 0) {
      await model.bulkWrite(batch);
      processedCount += batch.length;
    }

    this.logger.log(
      `[${job.id}] Complete. Updated ${processedCount} docs in ${modelName}.`,
    );
    return { success: true, processedCount };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }
}
