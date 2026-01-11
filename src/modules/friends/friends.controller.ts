import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '@guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '@app/common';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  private readonly logger = new Logger(FriendsController.name);
  constructor(private readonly friendsService: FriendsService) {}

  @Post('follow/:targetId')
  async followUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('targetId') targetId: string,
  ) {
    this.logger.log(
      `Hit endpoint: followUser user=${user._id} target=${targetId}`,
    );
    return this.friendsService.follow(user._id.toString(), targetId);
  }

  @Post('unfollow/:targetId')
  async unfollowUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('targetId') targetId: string,
  ) {
    this.logger.log(
      `Hit endpoint: unfollowUser user=${user._id} target=${targetId}`,
    );
    return this.friendsService.unfollow(user._id.toString(), targetId);
  }

  @Get('users')
  async getUsers(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: getUsers user=${user._id}`);
    return this.friendsService.getUsersWithFollowStatus(user._id.toString());
  }
}
