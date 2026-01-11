import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { GameMode, GameType } from '../enums';

export class StartGameDto {
  @IsEnum(GameType)
  type: GameType;

  @IsEnum(GameMode)
  mode: GameMode;
}

export class StartGameExtraDto extends StartGameDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @ArrayMinSize(1)
  playerIds: string[];
}

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  gameType?: string;
}
