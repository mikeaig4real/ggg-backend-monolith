import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PlanInterval {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ANNUALLY = 'annually',
}

export class CreatePlanDto {
  @ApiProperty({ description: 'Name of the plan', example: 'Premium Plan' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Amount for the plan', example: 5000 })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Interval of the plan',
    enum: PlanInterval,
    example: PlanInterval.MONTHLY,
  })
  @IsEnum(PlanInterval)
  interval: PlanInterval;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency: string;
}

export interface PlanResponse {
  planCode: string;
  name: string;
  amount: number;
  interval: string;
}
