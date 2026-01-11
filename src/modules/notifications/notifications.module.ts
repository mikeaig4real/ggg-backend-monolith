import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import {
  Notification,
  NotificationSchema,
} from './channels/in-app/schemas/notification.schema';
import { InAppChannel } from './channels/in-app/in-app.channel';
import { EmailChannel } from './channels/email/email.channel';
import { LoggerEmailProvider } from './channels/email/providers/logger.email.provider';
import { SendGridProvider } from './channels/email/providers/sendgrid.provider';
import { MailgunProvider } from './channels/email/providers/mailgun.provider';
import { ResendProvider } from './channels/email/providers/resend.provider';
import { MailchimpProvider } from './channels/email/providers/mailchimp.provider';
import { SmsChannel } from './channels/sms/sms.channel';
import { PushChannel } from './channels/push/push.channel';
import { LoggerSmsProvider } from './channels/sms/providers/logger.sms.provider';
import { ClickSendSmsProvider } from './channels/sms/providers/clicksend.provider';
import { VonageSmsProvider } from './channels/sms/providers/vonage.provider';
import { TwilioSmsProvider } from './channels/sms/providers/twilio.provider';
import { TermiiSmsProvider } from './channels/sms/providers/termii.provider';
import { AfricasTalkingSmsProvider } from './channels/sms/providers/africastalking.provider';
import { LoggerPushProvider } from './channels/push/providers/logger.push.provider';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FirebasePushProvider } from './channels/push/providers/firebase.push.provider';
import { WhatsappChannel } from './channels/socials/whatsapp/whatsapp.channel';
import { MetaWhatsappProvider } from './channels/socials/whatsapp/providers/meta.whatsapp.provider';
import { SlackChannel } from './channels/socials/slack/slack.channel';
import { SlackProvider } from './channels/socials/slack/providers/slack.provider';
import { UsersModule } from '../users/users.module';
import {
  QueueModule,
  NOTIFICATION_QUEUE,
  NOTIFICATION_EMAIL_QUEUE,
  NOTIFICATION_PUSH_QUEUE,
  NOTIFICATION_SMS_QUEUE,
  NOTIFICATION_IN_APP_QUEUE,
  NOTIFICATION_WHATSAPP_QUEUE,
  NOTIFICATION_SLACK_QUEUE,
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  PUSH_PROVIDER,
  WHATSAPP_PROVIDER,
  SLACK_PROVIDER,
} from '@app/common';
import { NotificationProcessor } from './notification.processor';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { EmailProcessor } from './processors/email.processor';
import { PushProcessor } from './processors/push.processor';
import { SmsProcessor } from './processors/sms.processor';
import { InAppProcessor } from './processors/in-app.processor';
import { WhatsappProcessor } from './processors/whatsapp.processor';
import { SlackProcessor } from './processors/slack.processor';
import { HttpService } from '@nestjs/axios';
import { ControlCenterModule } from '../control-center/control-center.module';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    forwardRef(() => UsersModule),
    ConfigModule,
    ControlCenterModule,
    QueueModule.register({ name: NOTIFICATION_QUEUE }),
    QueueModule.register({ name: NOTIFICATION_EMAIL_QUEUE }),
    QueueModule.register({ name: NOTIFICATION_PUSH_QUEUE }),
    QueueModule.register({ name: NOTIFICATION_SMS_QUEUE }),
    QueueModule.register({ name: NOTIFICATION_IN_APP_QUEUE }),
    QueueModule.register({ name: NOTIFICATION_WHATSAPP_QUEUE }),
    QueueModule.register({ name: NOTIFICATION_SLACK_QUEUE }),
    BullBoardModule.forFeature({
      name: NOTIFICATION_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: NOTIFICATION_EMAIL_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: NOTIFICATION_PUSH_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: NOTIFICATION_SMS_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: NOTIFICATION_IN_APP_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: NOTIFICATION_WHATSAPP_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: NOTIFICATION_SLACK_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    InAppChannel,
    EmailChannel,
    SmsChannel,
    PushChannel,
    WhatsappChannel,
    SlackChannel,
    NotificationProcessor,
    EmailProcessor,
    PushProcessor,
    SmsProcessor,
    InAppProcessor,
    WhatsappProcessor,
    SlackProcessor,
    {
      provide: EMAIL_PROVIDER,
      useClass: LoggerEmailProvider, // Placeholder or remove if not needed anymore
    },
    SendGridProvider,
    MailgunProvider,
    ResendProvider,
    MailchimpProvider,
    LoggerEmailProvider,

    ClickSendSmsProvider,
    VonageSmsProvider,
    TwilioSmsProvider,
    TermiiSmsProvider,
    AfricasTalkingSmsProvider,
    LoggerSmsProvider,

    FirebasePushProvider,
    LoggerPushProvider,

    MetaWhatsappProvider,

    SlackProvider,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
