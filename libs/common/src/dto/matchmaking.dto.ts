import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JoinRandomQueueDto {
  @IsString()
  @IsNotEmpty()
  gameType: string;

  @IsString()
  @IsNotEmpty()
  tier: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  betAmount: number;
}

export class CreateLobbyDto {
  @IsString()
  @IsNotEmpty()
  gameType: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  betAmount: number;
}

export class JoinLobbyDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class PlayBotDto {
  @IsString()
  @IsNotEmpty()
  gameType: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  betAmount: number;
}
