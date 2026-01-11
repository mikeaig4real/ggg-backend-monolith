import { IsString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFriendDto {
  @ApiProperty({ description: 'The ID of the user to befriend' })
  @IsString()
  friendId: string;
}

export class FriendDto {
  ownerId: string;
  friendId: string;
  type: 'following' | 'follower';
  followRound: number;
}
