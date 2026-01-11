import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

export const PositiveAmountSchema = z
  .number()
  .positive('Amount must be positive');

export const MongoIdSchema = z
  .string()
  .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: 'Invalid ID format',
  });

export const UsernameSchema = z.string().min(3).max(30);

export const GameTypeSchema = z.enum(['dice', 'coin', 'crash', 'limbo'], {
  message: 'Invalid game type',
});

export const TierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum'], {
  message: 'Invalid matching tier',
});

export const LobbyCodeSchema = z
  .string()
  .length(4)
  .regex(/^[A-Z0-9]{4}$/, 'Invalid lobby code format');

export function validateWith<T>(
  schema: z.ZodSchema<T>,
  data: any,
  options?: { quiet?: false },
): T;
export function validateWith<T>(
  schema: z.ZodSchema<T>,
  data: any,
  options: { quiet: true },
): T | null;
export function validateWith<T>(
  schema: z.ZodSchema<T>,
  data: any,
  options: { quiet?: boolean } = {},
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((e: any) => e.message).join(', ');
    console.error(`Validation Failed: ${message}`);
    if (options.quiet) return null;
    throw new BadRequestException(message);
  }
  return result.data;
}

export const FollowSchema = z
  .object({
    userId: MongoIdSchema,
    targetId: MongoIdSchema,
  })
  .refine((data) => data.userId !== data.targetId, {
    message: 'You cannot follow yourself',
    path: ['targetId'],
  });

export const PaymentProviderNameSchema = z.enum(
  ['stripe', 'paystack', 'flutterwave'],
  {
    message: 'Payment provider not supported',
  },
);

export const NotificationChannelTypeSchema = z.enum([
  'in-app',
  'email',
  'sms',
  'push',
]);

export const NotificationTypeSchema = z.enum([
  'info',
  'success',
  'warning',
  'error',
  'transaction',
  'social',
  'system',
]);

export const NotificationPayloadSchema = z
  .object({
    title: z.string().min(1, 'Title is required').optional(),
    message: z.string().min(1, 'Message is required'),
    userIds: z
      .array(MongoIdSchema)
      .min(1, 'At least one recipient is required'),
    channels: z.array(NotificationChannelTypeSchema).optional(),
    html: z.string().optional(),
    type: NotificationTypeSchema.optional().default('info'),
    metadata: z.record(z.string(), z.any()).optional(),
    template: z.string().optional(),
    context: z.record(z.string(), z.any()).optional(),
  })
  .refine(
    (data) => {
      if (data.channels?.includes('sms') && !data.message) {
        return false;
      }
      return true;
    },
    { message: 'SMS requires a message' },
  );

export const LoginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterPushTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  type: z.enum(['mobile', 'web'], { message: 'Invalid token type' }),
});

export const NotificationRecipientSchema = z.object({
  id: MongoIdSchema,
  email: z.email('Invalid email address').optional(),
  phoneNumber: z.string().optional(),
  pushToken: z.string().optional(),
  mobilePushToken: z.string().optional(),
  webPushToken: z.string().optional(),
  username: z.string().optional(),
  notificationSettings: z
    .object({
      channels: z.record(z.string(), z.boolean()).optional(),
    })
    .optional(),
});

export const NotificationDataSchema = z.object({
  title: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
  html: z.string().optional(),
  type: NotificationTypeSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  template: z.string().optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export const EmailChannelDataSchema = NotificationDataSchema.extend({
  title: z.string().min(1, 'Email subject (title) is required'),
});

export const SmsChannelDataSchema = NotificationDataSchema.extend({
  message: z.string().min(1, 'SMS message is required'),
});

export const PushChannelDataSchema = NotificationDataSchema.extend({
  title: z.string().min(1, 'Push title is required'),
  message: z.string().min(1, 'Push message is required'),
});

export const InAppChannelDataSchema = NotificationDataSchema.extend({
  message: z.string().min(1, 'In-App message is required'),
  type: NotificationTypeSchema,
});
