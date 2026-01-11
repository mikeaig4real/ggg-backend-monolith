import { IsString, IsUUID } from 'class-validator';

export class GetGameStateDto {
  @IsString()
  gameType: string;

  @IsUUID()
  gameId: string;
}
