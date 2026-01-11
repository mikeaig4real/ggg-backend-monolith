import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchemaMigrationService } from './schema-migration.service';
import { SchemaMigrationProcessor } from './schema-migration.processor';
import { SCHEMA_MIGRATION_QUEUE } from '../constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: SCHEMA_MIGRATION_QUEUE,
    }),
  ],
  providers: [SchemaMigrationService, SchemaMigrationProcessor],
  exports: [SchemaMigrationService],
})
export class SchemaMigrationModule {}
