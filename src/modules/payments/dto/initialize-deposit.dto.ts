import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PaymentCurrency {
  NGN = 'NGN',
  USD = 'USD',
}

export class InitializeDepositDto {
  @ApiProperty({ description: 'User ID', required: false })
  @IsString()
  @IsOptional()
  userId: string;

  @ApiProperty({
    description: 'Email to associate with payment',
    example: 'user@example.com',
  })
  @IsString()
  email: string;

  @ApiProperty({ description: 'Amount to deposit', minimum: 1, example: 5000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Currency',
    enum: PaymentCurrency,
    example: PaymentCurrency.USD,
  })
  @IsEnum(PaymentCurrency)
  currency: PaymentCurrency;

  @ApiProperty({
    description: 'Callback URL',
    required: false,
    example: 'https://app.com/callback',
  })
  @IsString()
  @IsOptional()
  callbackUrl?: string;

  @ApiProperty({ description: 'Metadata', required: false })
  @IsString()
  @IsOptional()
  metadata?: Record<string, any>;
}

export interface PaymentInitializationResponse {
  reference: string;
  authorizationUrl: string;
}

export interface PaymentVerificationResponse {
  status: 'success' | 'failed' | 'pending';
  reference: string;
  amount: number;
  currency: string;
  metadata?: any;
}
