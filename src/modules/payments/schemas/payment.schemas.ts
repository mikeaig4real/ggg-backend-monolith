import { z } from 'zod';

export const InitializeDepositSchema = z.object({
  userId: z.string().optional(),
  email: z.email(),
  amount: z.number().min(1),
  currency: z.enum(['NGN', 'USD', 'EUR', 'GBP']).optional(),
  callbackUrl: z.string().optional(),
  metadata: z.record(z.any(), z.any()).optional(),
});

export const CreateTransferRecipientSchema = z.object({
  type: z.string(),
  name: z.string(),
  accountNumber: z.string(),
  bankCode: z.string(),
  currency: z.string().optional(),
});

export const InitiateTransferSchema = z.object({
  amount: z.number().positive(),
  recipientCode: z.string(),
  reason: z.string().optional(),
  reference: z.string().optional(),
});

export const CreatePlanSchema = z.object({
  name: z.string(),
  amount: z.number().positive(),
  interval: z.enum([
    'hourly',
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'annually',
  ]),
  currency: z.string().optional(),
});

export const PaystackChargeSuccessSchema = z.object({
  event: z.string(),
  data: z.object({
    amount: z.number(),
    reference: z.string(),
    metadata: z
      .object({
        userId: z.string().optional(),
      })
      .optional(),
  }),
});

export const FlutterwaveChargeCompletedSchema = z.object({
  event: z.string(),
  data: z.object({
    id: z.number(),
    status: z.string(),
    amount: z.number(),
    tx_ref: z.string(),
    meta: z
      .object({
        userId: z.string().optional(),
      })
      .optional(),
  }),
});

export const StripeCheckoutSessionSchema = z.object({
  id: z.string(),
  payment_status: z.string(),
  amount_total: z.number().nullable(),
  metadata: z
    .object({
      userId: z.string().optional(),
    })
    .nullable()
    .optional(),
});
