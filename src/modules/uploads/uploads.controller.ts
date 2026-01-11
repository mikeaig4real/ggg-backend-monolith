import {
  Controller,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import type { FastifyRequest } from 'fastify';
import '@fastify/multipart';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  async uploadFile(@Req() req: FastifyRequest): Promise<{ url: string }> {
    const multipartReq = req as any;
    if (!multipartReq.isMultipart()) {
      throw new BadRequestException('Request is not multipart');
    }

    const data = await multipartReq.file();
    if (!data) {
      this.logger.warn('Upload attempt failed: No file uploaded');
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(
      `Hit UploadsController.uploadFile with args: filename=${data.filename}, mimetype=${data.mimetype}, size=${data.file.length}`,
    );

    // Convert the stream to a buffer for compatibility with our service/provider
    const buffer = await data.toBuffer();

    const file: any = {
      buffer: buffer,
      mimetype: data.mimetype,
      originalname: data.filename,
      size: buffer.length,
    };

    return this.uploadsService.uploadFile(file);
  }
}
