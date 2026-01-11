import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  INotificationChannel,
  NotificationData,
  NotificationRecipient,
} from '@modules/notifications/interfaces/notification-channel.interface';
import { Notification } from './schemas/notification.schema';

import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NOTIFICATION_EVENTS,
  validateWith,
  InAppChannelDataSchema,
  NotificationRecipientSchema,
} from '@app/common';

@Injectable()
export class InAppChannel implements INotificationChannel {
  private readonly logger = new Logger(InAppChannel.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    private eventEmitter: EventEmitter2,
  ) {}

  async send(
    recipients: NotificationRecipient[],
    data: NotificationData,
  ): Promise<void> {
    validateWith(InAppChannelDataSchema, data);

    const operations: any[] = [];

    for (const recipient of recipients) {
      const validated = validateWith(NotificationRecipientSchema, recipient, {
        quiet: true,
      });

      if (!validated) {
        this.logger.warn(
          `InAppChannel: Recipient validation failed for ${recipient.id || 'unknown'}. Skipping.`,
        );
        continue;
      }

      // Prepare Persistence Operation
      operations.push({
        insertOne: {
          document: {
            userId: validated.id,
            title: data.title || 'Notification',
            message: data.message,
            type: data.type,
            metadata: data.metadata,
            read: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      });

      // Real-time Emission (could also be done after bulkWrite for transactional safety)
      this.eventEmitter.emit(NOTIFICATION_EVENTS.NEW_NOTIFICATION, {
        userId: validated.id,
        notification: data,
      });
    }

    if (operations.length > 0) {
      await this.notificationModel.bulkWrite(operations);
    }
  }
}
