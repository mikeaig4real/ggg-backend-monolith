import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransferRecipientDto {
  @ApiProperty({ description: 'Recipient type', example: 'nuban' })
  @IsString()
  @IsNotEmpty()
  type: string; // 'nuban' etc

  @ApiProperty({ description: 'Recipient name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Account number', example: '0123456789' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({ description: 'Bank code', example: '058' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({ description: 'Currency', required: false, example: 'NGN' })
  @IsString()
  @IsOptional()
  currency?: string;
}

export interface TransferRecipientResponse {
  recipientCode: string;
  details: any;
}

export class InitiateTransferDto {
  @ApiProperty({
    description: 'Amount to transfer',
    minimum: 100,
    example: 5000,
  })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ description: 'Recipient code', example: 'RCP_123456' })
  @IsString()
  recipientCode: string;

  @ApiProperty({
    description: 'Reason for transfer',
    required: false,
    example: 'Payment for services',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ description: 'Unique reference', example: 'ref_123456' })
  @IsString()
  reference: string;
}

export interface TransferResponse {
  reference: string;
  status: string;
  transferCode?: string;
}
