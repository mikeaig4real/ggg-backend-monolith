import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFundingPackageDto {
  @ApiProperty({
    description: 'Amount of the funding package',
    example: 1000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Label for the package',
    example: 'Gold Package',
  })
  @IsString()
  label: string;

  @ApiProperty({
    description: 'Whether the package is active',
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
