import {
  AbstractRepository,
  WALLET_CREATION_QUEUE,
  WALLET_JOB_NAMES,
} from '@app/common';
import { Injectable, Logger } from '@nestjs/common';
import { User } from './schemas/user.schema';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class UsersRepository extends AbstractRepository<User> {
  protected readonly logger = new Logger(UsersRepository.name);

  constructor(
    @InjectModel(User.name) userModel: Model<User>,
    @InjectConnection() connection: Connection,
    @InjectQueue(WALLET_CREATION_QUEUE) private walletQueue: Queue,
  ) {
    super(userModel, connection);
  }

  async create(document: Omit<User, '_id'>): Promise<User> {
    this.logger.log(`Hit Repo: create args=${JSON.stringify(document)}`);
    const user = await super.create(document);
    await this.walletQueue.add(WALLET_JOB_NAMES.CREATE_WALLET, {
      userId: user._id.toString(),
      email: user.email,
    });
    this.logger.log(
      `[UsersRepository] User created: ${user._id}. Wallet creation job added.`,
    );
    return user;
  }
  async getAll() {
    this.logger.log('Hit Repo: getAll');
    return this.model.find({}).lean();
  }

  async findMany<T = User>(
    ids: string[],
    projection?: Record<string, any>,
  ): Promise<T[]> {
    this.logger.log(
      `Hit Repo: findMany args=${JSON.stringify({ ids, projection })}`,
    );
    if (!ids || ids.length === 0) return [];

    if (projection) {
      const objectIds = ids.map((id) => new Types.ObjectId(id));

      return this.model.aggregate<T>([
        { $match: { _id: { $in: objectIds } } },
        {
          $project: {
            id: { $toString: '$_id' },
            _id: 0,
            ...projection,
          },
        },
      ]);
    }

    return this.model.find({ _id: { $in: ids } }).lean() as unknown as T[];
  }
}
