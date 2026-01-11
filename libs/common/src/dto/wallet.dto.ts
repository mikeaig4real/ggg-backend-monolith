import {
  IsNumber,
  Min,
  IsNotEmpty,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DepositDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;
}

export class WithdrawDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsNotEmpty()
  address: string;
}

export class LockFundsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsString()
  @IsOptional()
  matchId?: string;
}

export class SettleFundsDto {
  @IsString()
  @IsNotEmpty()
  matchId: string;

  @IsString()
  @IsNotEmpty()
  winnerId: string;

  @IsNumber()
  @Min(0)
  totalPool: number;
}
