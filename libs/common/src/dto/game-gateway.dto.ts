import { IsString, IsNotEmpty } from 'class-validator';

export class RollDiceDto {
  @IsString()
  @IsNotEmpty()
  matchId: string;
}
