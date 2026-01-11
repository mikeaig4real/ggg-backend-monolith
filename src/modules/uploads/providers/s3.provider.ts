import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { IUploadProvider } from '../interfaces/upload-provider.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Provider implements IUploadProvider {
  private readonly logger = new Logger(S3Provider.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    if (region && accessKeyId && secretAccessKey && this.bucketName) {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.logger.warn(
        'AWS S3 credentials missing. S3Provider will not function correctly.',
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; publicId?: string }> {
    this.logger.log(
      `Hit S3Provider.uploadFile with args: filename=${file.originalname}`,
    );
    if (!this.s3Client) {
      throw new Error('S3 Client not initialized');
    }

    const key = `uploads/${uuidv4()}-${file.originalname}`;

    const params: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    try {
      await this.s3Client.send(new PutObjectCommand(params));

      const url = `https://${this.bucketName}.s3.${this.configService.get<string>(
        'AWS_REGION',
      )}.amazonaws.com/${key}`;

      this.logger.log(`Successfully uploaded to S3: ${url}`);

      return {
        url,
        publicId: key,
      };
    } catch (error) {
      this.logger.error('S3 upload failed', error);
      throw error;
    }
  }
}
