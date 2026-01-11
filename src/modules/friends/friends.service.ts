import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Friend, FriendDocument } from './schemas/friend.schema';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationType,
  NotificationChannelType,
} from '../notifications/interfaces/notification-payload.interface';
import { enrichFollowTemplate } from '../notifications/channels/email/templates/general/follow';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { validateWith, FollowSchema } from '@app/common';

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);
  constructor(
    @InjectModel(Friend.name) private friendModel: Model<FriendDocument>,
    private usersService: UsersService,
    private usersRepository: UsersRepository,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {}

  async follow(userId: string, targetId: string) {
    this.logger.log(
      `Hit Service: follow args=${JSON.stringify({ userId, targetId })}`,
    );
    validateWith(FollowSchema, { userId, targetId });

    // Check if I already have a relationship with this person (as owner)
    const existingRelationship = await this.friendModel.findOne({
      ownerId: userId,
      friendId: targetId,
    });

    if (existingRelationship && existingRelationship.type === 'following') {
      throw new BadRequestException('Already following this user');
    }

    // Check if target already follows user (Mutuality check)
    const isTargetFollowingUser = await this.friendModel.findOne({
      ownerId: targetId,
      friendId: userId,
      type: 'following',
    });

    const followRound = isTargetFollowingUser ? 2 : 1;

    // Update or Create "Following" record for Me
    await this.friendModel.findOneAndUpdate(
      { ownerId: userId, friendId: targetId },
      {
        type: 'following',
        followRound,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    // Update or Create "Follower" record for Target
    await this.friendModel.findOneAndUpdate(
      { ownerId: targetId, friendId: userId },
      {
        type: 'follower',
        followRound,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    if (isTargetFollowingUser) {
      // Mutual!
      // Update ME: 'following', round 2
      await this.friendModel.findOneAndUpdate(
        { ownerId: userId, friendId: targetId },
        { type: 'following', followRound: 2 },
        { upsert: true },
      );
      // Update THEM: 'following', round 2 (They were already following)
      await this.friendModel.findOneAndUpdate(
        { ownerId: targetId, friendId: userId },
        { followRound: 2 }, // Keep type as following
      );
    } else {
      // Not Mutual (One way)
      // Me: 'following', round 1
      await this.friendModel.findOneAndUpdate(
        { ownerId: userId, friendId: targetId },
        { type: 'following', followRound: 1 },
        { upsert: true },
      );
      // Them: 'follower', round 1
      await this.friendModel.findOneAndUpdate(
        { ownerId: targetId, friendId: userId },
        { type: 'follower', followRound: 1 },
        { upsert: true },
      );
    }

    try {
      await this.notificationsService.sendFollowNotification({
        followerId: userId,
        targetId,
        followRound,
      });
    } catch (err) {
      this.logger.error(`Failed to send follow notification: ${err.message}`);
    }

    return { success: true, followRound };
  }

  async unfollow(userId: string, targetId: string) {
    this.logger.log(
      `Hit Service: unfollow args=${JSON.stringify({ userId, targetId })}`,
    );

    // Delete my relationship document
    await this.friendModel.deleteOne({
      ownerId: userId,
      friendId: targetId,
    });

    // Handle "Follower" record on the other side
    const targetRel = await this.friendModel.findOne({
      ownerId: targetId,
      friendId: userId,
    });

    if (targetRel) {
      if (targetRel.type === 'follower') {
        // They only knew me as a follower -> Delete it
        await this.friendModel.deleteOne({ _id: targetRel._id });
      } else if (targetRel.type === 'following') {
        // They follow me. Downgrade mutuality if it was round 2
        if (targetRel.followRound === 2) {
          targetRel.followRound = 1;
          await targetRel.save();
        }
      }
    }

    // Send Unfollow Notification to Target (In-App Only)
    try {
      await this.notificationsService.sendUnfollowNotification({
        followerId: userId,
        targetId,
      });
    } catch (err) {
      this.logger.error(`Failed to send unfollow notification: ${err.message}`);
    }

    return { success: true };
  }

  async getUsersWithFollowStatus(currentUserId: string) {
    this.logger.log(
      `Hit Service: getUsersWithFollowStatus args=${JSON.stringify({ currentUserId })}`,
    );

    // Aggregation Implementation
    const pipeline: any[] = [
      {
        $match: {
          _id: { $ne: new Types.ObjectId(currentUserId) },
        },
      },
      {
        $lookup: {
          from: 'friends',
          let: { userId: { $toString: '$_id' } }, // Convert User ObjectID to string to match friendId
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$ownerId', currentUserId] },
                    { $eq: ['$friendId', '$$userId'] },
                  ],
                },
              },
            },
          ],
          as: 'friendship',
        },
      },
      {
        $unwind: {
          path: '$friendship',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          username: 1,
          profilePicture: 1,
          isFollowing: { $eq: ['$friendship.type', 'following'] },
          isFollower: { $eq: ['$friendship.type', 'follower'] },
          followRound: { $ifNull: ['$friendship.followRound', 0] },
        },
      },
    ];
    return (this.usersRepository as any).model.aggregate(pipeline);
  }
  async cleanupUser(userId: string, session?: ClientSession): Promise<any> {
    this.logger.log(
      `Hit Service: cleanupUser args=${JSON.stringify({ userId })}`,
    );
    const result = await this.friendModel.deleteMany(
      {
        $or: [{ ownerId: userId }, { friendId: userId }],
      },
      { session },
    );
    this.logger.log(
      `Deleted ${result.deletedCount} relationship records for user ${userId}`,
    );
    return result;
  }
}
