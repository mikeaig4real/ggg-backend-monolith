import { UsersService } from '@modules/users/users.service';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { SendNotificationDto } from './dto/send-notification.dto';
import { InAppChannel } from './channels/in-app/in-app.channel';
import { EmailChannel } from './channels/email/email.channel';
import { SmsChannel } from './channels/sms/sms.channel';
import { PushChannel } from './channels/push/push.channel';
import { WhatsappChannel } from './channels/socials/whatsapp/whatsapp.channel';
import { SlackChannel } from './channels/socials/slack/slack.channel';
import { NotificationChannelType } from './interfaces/notification-payload.interface';
import { Notification } from './channels/in-app/schemas/notification.schema';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NOTIFICATION_QUEUE,
  NOTIFICATION_EMAIL_QUEUE,
  NOTIFICATION_PUSH_QUEUE,
  NOTIFICATION_SMS_QUEUE,
  NOTIFICATION_IN_APP_QUEUE,
  NOTIFICATION_WHATSAPP_QUEUE,
  NOTIFICATION_SLACK_QUEUE,
  validateWith,
  NotificationPayloadSchema,
} from '@app/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from './interfaces/notification-payload.interface';
import { enrichFollowTemplate } from './channels/email/templates/general/follow';
import {
  TransactionUpdateType,
  enrichTransactionUpdateTemplate,
} from './channels/email/templates/general/transaction-update';
import { NotificationRecipient } from './interfaces/notification-channel.interface';
import { enrichVerificationTemplate } from './channels/email/templates/general/verification';
import { User } from '@modules/users/schemas/user.schema';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    private readonly inAppChannel: InAppChannel,
    private readonly emailChannel: EmailChannel,
    private readonly smsChannel: SmsChannel,
    private readonly pushChannel: PushChannel,
    private readonly whatsappChannel: WhatsappChannel,
    private readonly slackChannel: SlackChannel,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
    @InjectQueue(NOTIFICATION_EMAIL_QUEUE)
    private readonly emailQueue: Queue,
    @InjectQueue(NOTIFICATION_PUSH_QUEUE)
    private readonly pushQueue: Queue,
    @InjectQueue(NOTIFICATION_SMS_QUEUE)
    private readonly smsQueue: Queue,
    @InjectQueue(NOTIFICATION_IN_APP_QUEUE)
    private readonly inAppQueue: Queue,
    @InjectQueue(NOTIFICATION_WHATSAPP_QUEUE)
    private readonly whatsappQueue: Queue,
    @InjectQueue(NOTIFICATION_SLACK_QUEUE)
    private readonly slackQueue: Queue,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async send(dto: SendNotificationDto) {
    this.logger.log(`Hit Service: send args=${JSON.stringify(dto)}`);
    validateWith(NotificationPayloadSchema, dto);
    this.logger.log(`Queueing notification for ${dto.userIds.length} users`);
    await this.notificationQueue.add('send', dto, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
    });
    return { queued: true, recipients: dto.userIds.length };
  }

  async dispatch(dto: SendNotificationDto) {
    this.logger.log(`Hit Service: dispatch args=${JSON.stringify(dto)}`);
    // Default to In-App if no channels specified
    const channels = dto.channels || [NotificationChannelType.IN_APP];

    // Centralized User Resolution
    let recipients: NotificationRecipient[] = [];
    try {
      if (dto.userIds && dto.userIds.length > 0) {
        recipients = await this.usersService.findByIds<NotificationRecipient>(
          dto.userIds,
          {
            email: 1,
            username: 1,
            phoneNumber: 1,
            pushToken: 1,
            mobilePushToken: 1,
            webPushToken: 1,
            notificationSettings: 1,
          },
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to resolve users for notification: ${err.message || err}`,
      );
      recipients = dto.userIds.map((id) => ({ id }));
    }

    const notificationData = {
      title: dto.title,
      message: dto.message,
      html: dto.html,
      type: dto.type,
      metadata: dto.metadata,
      template: dto.template,
      context: dto.context,
    };

    const jobs = [];
    const jobOptions = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    };

    if (channels.includes(NotificationChannelType.IN_APP)) {
      jobs.push(
        this.inAppQueue.add(
          'send-in-app',
          { recipients, data: notificationData },
          jobOptions,
        ),
      );
    }

    if (channels.includes(NotificationChannelType.EMAIL)) {
      jobs.push(
        this.emailQueue.add(
          'send-email',
          { recipients, data: notificationData },
          jobOptions,
        ),
      );
    }

    if (channels.includes(NotificationChannelType.SMS)) {
      jobs.push(
        this.smsQueue.add(
          'send-sms',
          { recipients, data: notificationData },
          jobOptions,
        ),
      );
    }

    if (channels.includes(NotificationChannelType.PUSH)) {
      jobs.push(
        this.pushQueue.add(
          'send-push',
          { recipients, data: notificationData },
          jobOptions,
        ),
      );
    }

    if (channels.includes(NotificationChannelType.WHATSAPP)) {
      jobs.push(
        this.whatsappQueue.add(
          'send-whatsapp',
          { recipients, data: notificationData },
          jobOptions,
        ),
      );
    }

    if (channels.includes(NotificationChannelType.SLACK)) {
      jobs.push(
        this.slackQueue.add(
          'send-slack',
          { recipients, data: notificationData },
          jobOptions,
        ),
      );
    }

    await Promise.all(jobs);

    return { dispatched: true, recipients: dto.userIds.length, channels };
  }

  async sendFollowNotification(data: {
    followerId: string;
    targetId: string;
    followRound: number;
    action?: string;
  }) {
    // Fetch users details
    const follower = await this.usersService.findById(data.followerId);
    const targetUser = await this.usersService.findById(data.targetId);

    if (!follower || !targetUser) {
      this.logger.warn(
        `Failed to send follow notification: Follower or Target not found. ids: ${data.followerId}, ${data.targetId}`,
      );
      return;
    }

    // Generate profile URL
    const frontendUrl =
      this.configService.get('FRONTEND_URL') || 'https://ggg.com';
    const profileUrl = `${frontendUrl}/u/${follower.username}`;

    const emailHtml = enrichFollowTemplate({
      username: targetUser.username,
      followerName: follower.username,
      profileUrl,
    });

    await this.dispatch({
      userIds: [data.targetId],
      title: 'New Follower!',
      message: `${follower.username} started following you.`,
      html: emailHtml,
      type: NotificationType.SOCIAL,
      channels: [
        NotificationChannelType.IN_APP,
        NotificationChannelType.PUSH,
        NotificationChannelType.EMAIL,
      ],
      metadata: {
        followerId: data.followerId,
        followerUsername: follower.username,
        followRound: data.followRound,
        action: data.action || 'view_profile',
      },
    });
  }

  async sendUnfollowNotification(data: {
    followerId: string;
    targetId: string;
  }) {
    // Fetch users details
    const follower = await this.usersService.findById(data.followerId);
    const targetUser = await this.usersService.findById(data.targetId);

    if (!follower || !targetUser) {
      this.logger.warn(
        `Failed to send unfollow notification: Follower or Target not found. ids: ${data.followerId}, ${data.targetId}`,
      );
      return;
    }

    await this.dispatch({
      userIds: [data.targetId],
      title: 'Unfollowed',
      message: `${follower.username} unfollowed you.`,
      type: NotificationType.SOCIAL,
      channels: [NotificationChannelType.IN_APP], // Only In-App as requested
      metadata: {
        followerId: data.followerId,
        followerUsername: follower.username,
        action: 'view_profile',
      },
    });
  }

  async sendTransactionNotification(data: {
    userId: string;
    type: TransactionUpdateType;
    amount: number;
    currency: string;
    referenceId: string;
    transactionId?: string;
    escrowId?: string;
  }) {
    // Fetch user for template greeting
    let username = 'User';
    try {
      const user = await this.usersService.findById(data.userId);
      if (user) username = user.username;
    } catch (e) {
      this.logger.warn(
        `Could not fetch user for transaction notification: ${e.message}`,
      );
    }
    const date = new Date().toLocaleString();
    let transactionUrl = `${this.configService.get('FRONTEND_URL') || 'https://ggg.com'}/dashboard/transactions`;

    if (data.transactionId) {
      transactionUrl = `${transactionUrl}/${data.transactionId}`;
    } else if (data.escrowId) {
      transactionUrl = `${this.configService.get('FRONTEND_URL') || 'https://ggg.com'}/dashboard/escrow/${data.escrowId}`;
    }

    const html = enrichTransactionUpdateTemplate({
      username: username,
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      referenceId: data.referenceId,
      date,
      transactionUrl,
    });

    // Determine message and title based on type (Logic similar to template or simplified)
    let title = 'Wallet Update';
    let message = `There has been an update to your wallet.`;

    switch (data.type) {
      case TransactionUpdateType.DEPOSIT:
        title = 'Deposit Successful';
        message = `You have successfully deposited ${data.currency} ${data.amount}.`;
        break;
      case TransactionUpdateType.WITHDRAW:
        title = 'Withdrawal Successful';
        message = `You have successfully withdrawn ${data.currency} ${data.amount}.`;
        break;
      case TransactionUpdateType.LOCKED:
        title = 'Funds Locked';
        message = `${data.currency} ${data.amount} has been locked for game ${data.referenceId}.`;
        break;
      case TransactionUpdateType.RELEASED:
        title = 'Funds Released';
        message = `You have won ${data.currency} ${data.amount} from game ${data.referenceId}!`;
        break;
      case TransactionUpdateType.REFUNDED:
        title = 'Transaction Refunded';
        message = `A transaction of ${data.currency} ${data.amount} for game ${data.referenceId} has been refunded.`;
        break;
    }

    await this.dispatch({
      userIds: [data.userId],
      title,
      message,
      type: NotificationType.TRANSACTION,
      channels: [
        NotificationChannelType.IN_APP,
        NotificationChannelType.EMAIL,
        NotificationChannelType.PUSH,
      ],
      html,
      metadata: {
        url: transactionUrl,
        transactionId: data.transactionId,
        escrowId: data.escrowId,
        referenceId: data.referenceId,
      },
    });
  }

  async getUserNotifications(userId: string) {
    this.logger.log(
      `Hit Service: getUserNotifications args=${JSON.stringify({ userId })}`,
    );
    return this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async markAsRead(notificationId: string, userId: string) {
    this.logger.log(
      `Hit Service: markAsRead args=${JSON.stringify({ notificationId, userId })}`,
    );
    return this.notificationModel
      .findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true },
      )
      .exec();
  }

  async markAllAsRead(userId: string) {
    this.logger.log(
      `Hit Service: markAllAsRead args=${JSON.stringify({ userId })}`,
    );
    return this.notificationModel
      .updateMany({ userId, read: false }, { read: true })
      .exec();
  }

  async getUnreadCount(userId: string) {
    this.logger.log(
      `Hit Service: getUnreadCount args=${JSON.stringify({ userId })}`,
    );
    return this.notificationModel
      .countDocuments({ userId, read: false })
      .exec();
  }
  async cleanupUser(userId: string, session?: ClientSession): Promise<any> {
    this.logger.log(
      `Hit Service: cleanupUser args=${JSON.stringify({ userId })}`,
    );
    const result = await this.notificationModel
      .deleteMany({ userId }, { session })
      .exec();
    this.logger.log(
      `Deleted ${result.deletedCount} notifications for user ${userId}`,
    );
    return result;
  }

  async sendVerificationEmail(
    userId: string,
    email: string,
    code: string,
    username: string,
  ) {
    this.logger.log(
      `Hit Service: sendVerificationEmail args=${JSON.stringify({ email })}`,
    );

    const html = enrichVerificationTemplate({
      username,
      code,
    });

    // Dispatch directly or via email queue
    await this.emailChannel.send(
      [{ id: userId, email } as NotificationRecipient],
      {
        title: 'Verify your ggg email',
        message: `Your verification code is ${code}`,
        html,
        type: NotificationType.SYSTEM,
      },
    );
  }

  async sendSms(userId: string, phoneNumber: string, message: string) {
    this.logger.log(
      `Hit Service: sendSms args=${JSON.stringify({ userId, phoneNumber, message })}`,
    );
    await this.smsChannel.send(
      [{ id: userId, phoneNumber } as NotificationRecipient],
      {
        title: 'SMS Notification',
        message,
        type: NotificationType.SYSTEM,
      },
    );
    return { success: true, message: 'SMS sent successfully' };
  }

  async sendWhatsapp(userId: string, phoneNumber: string, message: string) {
    this.logger.log(
      `Hit Service: sendWhatsapp args=${JSON.stringify({ userId, phoneNumber, message })}`,
    );
    await this.whatsappChannel.send(
      [{ id: userId, phoneNumber } as NotificationRecipient],
      {
        title: 'WhatsApp Notification',
        message,
        type: NotificationType.SOCIAL,
      },
    );
    return { success: true, message: 'WhatsApp sent successfully' };
  }

  async sendSlack(message: string, channel?: string) {
    this.logger.log(
      `Hit Service: sendSlack args=${JSON.stringify({ message, channel })}`,
    );
    await this.slackChannel.send([{ id: 'system' } as NotificationRecipient], {
      to: channel,
      title: 'Slack Notification',
      message,
      type: NotificationType.SOCIAL,
    });
    return { success: true, message: 'Slack notification sent successfully' };
  }
}
