import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import admin from 'firebase-admin';
import {
  INotificationProvider,
  NotificationContact,
  PushPayload,
} from '@modules/notifications/interfaces/notification-provider.interface';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebasePushProvider
  implements INotificationProvider, OnModuleInit
{
  private readonly logger = new Logger(FirebasePushProvider.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    if (this.initialized) return;

    const serviceAccountPath = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );
    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );

    try {
      let credential;
      if (serviceAccountJson) {
        credential = admin.credential.cert(JSON.parse(serviceAccountJson));
      } else if (serviceAccountPath) {
        // Resolve path relative to CWD (project root)
        const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
        this.logger.log(`Loading Firebase credentials from: ${resolvedPath}`);

        if (!fs.existsSync(resolvedPath)) {
          this.logger.error(`File not found at ${resolvedPath}`);
          return;
        }

        const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
        const serviceAccount = JSON.parse(fileContent);
        credential = admin.credential.cert(serviceAccount);
      } else {
        this.logger.warn(
          'Firebase credentials not found (FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH). Push notifications will fail.',
        );
        return;
      }

      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential,
        });
        this.logger.log('Firebase Admin Initialized');
      }
      this.initialized = true;
    } catch (error: any) {
      this.logger.error(`Failed to initialize Firebase: ${error.message}`);
    }
  }

  getName(): string {
    return 'firebase';
  }

  async send(to: string, payload: PushPayload): Promise<any> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized, skipping push notification');
      return {
        success: false,
        skipped: true,
        reason: 'Firebase not initialized',
      };
    }

    const sanitizedData: Record<string, string> = {};
    if (payload.data) {
      Object.keys(payload.data).forEach((key) => {
        const value = payload.data![key];
        if (typeof value === 'object') {
          sanitizedData[key] = JSON.stringify(value);
        } else {
          sanitizedData[key] = String(value);
        }
      });
    }

    const baseMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: sanitizedData,
    };

    let message: admin.messaging.Message;

    if (to.startsWith('/topics/')) {
      message = {
        ...baseMessage,
        topic: to.replace('/topics/', ''),
      } as admin.messaging.Message;
    } else {
      message = {
        ...baseMessage,
        token: to,
      } as admin.messaging.Message;
    }

    try {
      this.logger.log(`[FirebasePushProvider] Sending push notification ${to}`);
      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message: ${response}`);
      return { success: true, messageId: response };
    } catch (error: any) {
      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        this.logger.warn(`Invalid token detected: ${to}`);
        return { success: false, invalidToken: true, error: error.message };
      }
      this.logger.error(
        `Error sending message: ${error.code} - ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Subscribes a device token to a topic.
   * contact.customFields.deviceToken is required.
   * contact.listId is treated as the Topic name.
   */
  async addContact(contact: NotificationContact): Promise<any> {
    if (!this.initialized) throw new Error('Firebase not initialized');

    const token = contact.customFields?.deviceToken;
    const topic =
      contact.listId ||
      this.configService.get<string>('FIREBASE_DEFAULT_TOPIC');

    if (!token) {
      throw new Error(
        'Device token required in customFields.deviceToken for Firebase subscription',
      );
    }
    if (!topic) {
      throw new Error('Topic (listId) required for Firebase subscription');
    }

    try {
      const response = await admin.messaging().subscribeToTopic(token, topic);
      this.logger.log(
        `Successfully subscribed to topic: ${response.successCount} success`,
      );
      return response;
    } catch (error: any) {
      this.logger.error(`Error subscribing to topic: ${error.message}`);
      throw error;
    }
  }
}
