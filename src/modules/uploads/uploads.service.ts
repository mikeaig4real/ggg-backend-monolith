import { Injectable, Inject, Logger } from '@nestjs/common';
import { UPLOAD_PROVIDER } from '@app/common';
import * as UploadInterfaces from './interfaces/upload-provider.interface';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @Inject(UPLOAD_PROVIDER)
    private readonly uploadProvider: UploadInterfaces.IUploadProvider<Express.Multer.File>,
  ) {}

  async uploadFile(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(
      `Hit UploadsService.uploadFile with args: filename=${file.originalname}, size=${file.size}`,
    );
    return this.uploadProvider.uploadFile(file);
  }
}
