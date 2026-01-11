import { NotificationType } from './notification-payload.interface';

export interface NotificationRecipient {
  id: string;
  email?: string;
  phoneNumber?: string;
  pushToken?: string;
  webPushToken?: string;
  username?: string;
  notificationSettings?: { channels?: Record<string, boolean> };
  // Add other fields as needed (e.g. preferences)
}

export interface INotificationChannel {
  /**
   * Send a notification to multiple recipients.
   * @param recipients Array of Enriched Recipient objects
   * @param data The notification content and metadata
   */
  send(
    recipients: NotificationRecipient[],
    data: NotificationData,
  ): Promise<void>;
}

export interface NotificationData {
  to?: string; // Specific recipient override (e.g. channel ID or phone number)
  title?: string;
  message: string;
  html?: string;
  type?: NotificationType;
  metadata?: Record<string, any>;
  template?: string; // For email/sms templates
  context?: Record<string, any>; // Variables for the template
}
