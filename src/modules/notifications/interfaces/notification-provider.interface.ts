export interface NotificationContact {
  email: string;
  firstName?: string;
  lastName?: string;
  listId?: string; // Optional: Provider specific list/audience ID
  customFields?: Record<string, any>;
}

export interface SmsPayload {
  text: string;
}

export interface EmailPayload {
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  context?: Record<string, any>;
  from?: string;
  attachments?: any[]; // Refine later if needed
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface WhatsappPayload {
  type: 'text' | 'template';
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: any[];
  };
}

export interface SlackPayload {
  text?: string;
  blocks?: any[]; // Block Kit
  channel?: string; // Optional override
}

export type NotificationPayload =
  | SmsPayload
  | EmailPayload
  | PushPayload
  | WhatsappPayload
  | SlackPayload;

export interface INotificationProvider<T = NotificationPayload> {
  /**
   * Send a notification through this provider.
   * @param to Recipient address/token (email, phone number, fcm token)
   * @param payload Content and metadata for the notification
   */
  send(to: string, payload: T): Promise<any>;

  /**
   * Add a contact to the provider's marketing/audience list.
   * @param contact Contact details
   */
  addContact(contact: NotificationContact): Promise<any>;

  /**
   * Get the provider name (e.g., 'sendgrid', 'twilio')
   */
  getName(): string;
}
