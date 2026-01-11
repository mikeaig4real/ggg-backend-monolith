import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SCHEMA_MIGRATION_QUEUE } from '../constants';

@Injectable()
export class SchemaMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaMigrationService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectQueue(SCHEMA_MIGRATION_QUEUE) private readonly migrationQueue: Queue,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Hit Service: onApplicationBootstrap');
    this.logger.log('Starting generic schema consistency check...');
    // Iterate over all registered models in this connection
    for (const modelName of Object.keys(this.connection.models)) {
      const model = this.connection.models[modelName];
      await this.checkAndMigrate(model, modelName);
    }
  }

  private async checkAndMigrate(model: Model<any>, modelName: string) {
    const schema = model.schema;

    for (const [path, schemaType] of Object.entries(schema.paths)) {
      const options = (schemaType as any).options;

      if (options.default !== undefined) {
        const defaultValue =
          typeof options.default === 'function'
            ? options.default()
            : options.default;

        // Count missing
        const missingCount = await model.countDocuments({
          [path]: { $exists: false },
        });

        if (missingCount > 0) {
          this.logger.log(
            `[${modelName}] Found ${missingCount} docs missing '${path}'. scheduling migration.`,
          );

          await this.migrationQueue.add(
            'migrate_field',
            {
              modelName, // Pass string name
              field: path,
              defaultValue,
            },
            {
              removeOnComplete: true,
              attempts: 3,
              backoff: 5000,
            },
          );
        }
      }
    }
  }
}
