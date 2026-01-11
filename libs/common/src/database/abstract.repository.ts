import { Logger, NotFoundException } from '@nestjs/common';
import {
  FilterQuery,
  Model,
  Types,
  UpdateQuery,
  SaveOptions,
  Connection,
  ClientSession,
} from 'mongoose';
import { AbstractDocument } from './abstract.schema';

export abstract class AbstractRepository<TDocument extends AbstractDocument> {
  protected abstract readonly logger: Logger;

  constructor(
    protected readonly model: Model<TDocument>,
    private readonly connection: Connection,
  ) {}

  async create(
    document: Omit<TDocument, '_id'>,
    options?: SaveOptions,
  ): Promise<TDocument> {
    this.logger.log(`Hit Repo: create args=${JSON.stringify(document)}`);
    const createdDocument = new this.model({
      ...document,
      _id: new Types.ObjectId(),
    });
    return (
      await createdDocument.save(options)
    ).toJSON() as unknown as TDocument;
  }

  async findOne(
    filterQuery: FilterQuery<TDocument>,
    projection?: Record<string, unknown>,
  ): Promise<TDocument> {
    this.logger.log(
      `Hit Repo: findOne args=${JSON.stringify({ filterQuery, projection })}`,
    );
    const document = await this.model.findOne(filterQuery, projection || {}, {
      lean: true,
    });

    if (!document) {
      this.logger.warn('Document not found with filterQuery', filterQuery);
      return null as unknown as TDocument;
    }

    return document as unknown as TDocument;
  }

  async findOneAndUpdate(
    filterQuery: FilterQuery<TDocument>,
    update: UpdateQuery<TDocument>,
  ): Promise<TDocument> {
    this.logger.log(
      `Hit Repo: findOneAndUpdate args=${JSON.stringify({ filterQuery, update })}`,
    );
    const document = await this.model.findOneAndUpdate(filterQuery, update, {
      lean: true,
      new: true,
    });

    if (!document) {
      this.logger.warn('Document not found with filterQuery', filterQuery);
      throw new NotFoundException('Document not found.');
    }

    return document as unknown as TDocument;
  }

  async upsert(
    filterQuery: FilterQuery<TDocument>,
    document: Partial<TDocument>,
  ): Promise<TDocument> {
    this.logger.log(
      `Hit Repo: upsert args=${JSON.stringify({ filterQuery, document })}`,
    );
    return this.model.findOneAndUpdate(filterQuery, document, {
      lean: true,
      upsert: true,
      new: true,
    }) as unknown as TDocument;
  }

  async find(filterQuery: FilterQuery<TDocument>): Promise<TDocument[]> {
    this.logger.log(`Hit Repo: find args=${JSON.stringify(filterQuery)}`);
    return this.model.find(
      filterQuery,
      {},
      { lean: true },
    ) as unknown as TDocument[];
  }

  async deleteOne(
    filterQuery: FilterQuery<TDocument>,
    options?: { session?: ClientSession },
  ): Promise<boolean> {
    this.logger.log(`Hit Repo: deleteOne args=${JSON.stringify(filterQuery)}`);
    const result = await this.model.deleteOne(filterQuery, options);
    return result.deletedCount > 0;
  }

  async startTransaction(): Promise<ClientSession> {
    const session = await this.connection.startSession();
    session.startTransaction();
    return session;
  }
}
