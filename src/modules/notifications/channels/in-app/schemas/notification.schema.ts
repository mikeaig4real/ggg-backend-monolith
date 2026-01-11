import { AbstractDocument } from '@app/common';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { NotificationType } from '@modules/notifications/interfaces/notification-payload.interface';

@Schema({ versionKey: false, timestamps: true, collection: 'notifications' })
export class Notification extends AbstractDocument {
  @Prop({ required: true, index: true })
  userId: string; // Recipient

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({
    type: String,
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type: NotificationType;

  @Prop({ default: false })
  read: boolean;

  @Prop({ type: Object })
  metadata?: Record<string, any>; // For deep linking or extra data
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
