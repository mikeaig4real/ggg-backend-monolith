import { Injectable, Logger } from '@nestjs/common';
import * as mongoose from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

@Injectable()
export class TransactionHelperService {
  private readonly logger = new Logger(TransactionHelperService.name);

  constructor(
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async runTransaction<T>(
    callback: (session: mongoose.ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T;
      await session.withTransaction(async (s) => {
        result = await callback(s);
      });
      return result!;
    } catch (error) {
      this.logger.error(`Transaction failed: ${error.message}`);
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
