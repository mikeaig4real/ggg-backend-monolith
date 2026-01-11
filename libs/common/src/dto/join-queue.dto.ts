import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class JoinQueueDto {
  @IsString()
  @IsNotEmpty()
  gameType: string;

  @IsString()
  @IsOptional()
  mode?: string;
}
