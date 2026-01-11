import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { CloudinaryProvider } from './providers/cloudinary.provider';
import { UsersModule } from '../users/users.module';
import { UPLOAD_PROVIDER } from '@app/common';
import { S3Provider } from './providers/s3.provider';
import { LoggerUploadProvider } from './providers/logger.provider';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    CloudinaryProvider,
    S3Provider,
    LoggerUploadProvider,
    {
      provide: UPLOAD_PROVIDER,
      useFactory: (config: ConfigService) => {
        const type = config.get('UPLOAD_PROVIDER_TYPE', 'logger'); // Default to logger if not set
        switch (type) {
          case 'cloudinary':
            return new CloudinaryProvider(config);
          case 's3':
            return new S3Provider(config);
          case 'logger':
          default:
            return new LoggerUploadProvider();
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
