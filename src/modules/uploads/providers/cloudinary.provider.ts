import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { IUploadProvider } from '../interfaces/upload-provider.interface';

@Injectable()
export class CloudinaryProvider implements IUploadProvider {
  private readonly logger = new Logger(CloudinaryProvider.name);

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL');

    if (cloudinaryUrl) {
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; publicId?: string }> {
    this.logger.log(
      `Starting Cloudinary upload for file: ${file.originalname}`,
    );
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'ggg/users', resource_type: 'auto' }, // Organize in a folder
        (error: any, result: UploadApiResponse) => {
          if (error) {
            this.logger.error('Cloudinary upload failed', error);
            return reject(error);
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
          this.logger.log(
            `Successfully uploaded to Cloudinary: ${result.secure_url}`,
          );
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
