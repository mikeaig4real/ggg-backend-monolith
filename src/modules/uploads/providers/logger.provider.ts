import { Injectable, Logger } from '@nestjs/common';
import { IUploadProvider } from '../interfaces/upload-provider.interface';

@Injectable()
export class LoggerUploadProvider implements IUploadProvider {
  private readonly logger = new Logger(LoggerUploadProvider.name);

  async uploadFile(file: any): Promise<{ url: string; publicId?: string }> {
    this.logger.log(
      `Hit LoggerUploadProvider.uploadFile with args: filename=${file.originalname}`,
    );
    // Return a dummy URL for local development
    return {
      url: `https://via.placeholder.com/150?text=${encodeURIComponent(
        file.originalname,
      )}`,
      publicId: `mock-${Date.now()}`,
    };
  }
}
