import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPaymentProvider } from '../../interfaces/payment-provider.interface';
import {
  InitializeDepositDto,
  PaymentInitializationResponse,
  PaymentVerificationResponse,
} from '../../dto/initialize-deposit.dto';
import {
  CreateTransferRecipientDto,
  InitiateTransferDto,
  TransferRecipientResponse,
  TransferResponse,
} from '../../dto/transfer.dto';
import { CreatePlanDto, PlanResponse } from '../../dto/create-plan.dto';
import Stripe from 'stripe';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  WALLET_OPERATIONS_QUEUE,
  WALLET_JOB_NAMES,
  validateWith,
} from '@app/common';
import {
  InitializeDepositSchema,
  CreateTransferRecipientSchema,
  InitiateTransferSchema,
  CreatePlanSchema,
  StripeCheckoutSessionSchema,
} from '../../schemas/payment.schemas';
import { z } from 'zod';

@Injectable()
export class StripeProvider implements IPaymentProvider {
  private readonly logger = new Logger(StripeProvider.name);
  private stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(WALLET_OPERATIONS_QUEUE)
    private readonly walletOperationsQueue: Queue,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';

    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured');
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-12-15.clover', // Use latest or configured version
      });
    }
  }

  getName(): string {
    return 'stripe';
  }

  async initializePayment(
    dto: InitializeDepositDto,
  ): Promise<PaymentInitializationResponse> {
    this.logger.log(`Hit stripe initializePayment args=${JSON.stringify(dto)}`);
    validateWith(InitializeDepositSchema, dto);
    if (!this.stripe) throw new Error('Stripe not configured');
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: dto.currency || 'usd',
              product_data: {
                name: 'Deposit',
              },
              unit_amount: Math.round(dto.amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${dto.callbackUrl}?reference={CHECKOUT_SESSION_ID}`,
        cancel_url: `${dto.callbackUrl}?status=cancelled`,
        metadata: {
          ...dto.metadata,
          userId: dto.metadata?.userId,
        },
        client_reference_id: dto.metadata?.userId,
      });

      return {
        reference: session.id,
        authorizationUrl: session.url!,
      };
    } catch (error: any) {
      this.logger.error(`Stripe initializePayment failed: ${error.message}`);
      throw error;
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    this.logger.log(
      `Hit stripe verifyPayment args=${JSON.stringify({ reference })}`,
    );
    validateWith(z.string(), reference);
    if (!this.stripe) throw new Error('Stripe not configured');
    try {
      const session = await this.stripe.checkout.sessions.retrieve(reference);

      let status: 'success' | 'failed' | 'pending' = 'pending';
      if (session.payment_status === 'paid') {
        status = 'success';
      } else if (session.status === 'expired' || session.status === 'open') {
        status = 'pending';
      } else {
        status = 'failed';
      }

      return {
        status,
        reference: session.id,
        amount: (session.amount_total || 0) / 100,
        currency: session.currency || 'usd',
        metadata: session.metadata,
      };
    } catch (error: any) {
      this.logger.error(`Stripe verifyPayment failed: ${error.message}`);
      throw error;
    }
  }

  async createTransferRecipient(
    dto: CreateTransferRecipientDto,
  ): Promise<TransferRecipientResponse> {
    this.logger.log(
      `Hit stripe createTransferRecipient args=${JSON.stringify(dto)}`,
    );
    validateWith(CreateTransferRecipientSchema, dto);

    throw new Error('Stripe transfer recipient creation not implemented yet.');
  }

  async initiateTransfer(dto: InitiateTransferDto): Promise<TransferResponse> {
    this.logger.log(`Hit stripe initiateTransfer args=${JSON.stringify(dto)}`);
    validateWith(InitiateTransferSchema, dto);

    throw new Error('Stripe transfers not implemented yet.');
  }

  async createPlan(dto: CreatePlanDto): Promise<PlanResponse> {
    this.logger.log(`Hit stripe createPlan args=${JSON.stringify(dto)}`);
    validateWith(CreatePlanSchema, dto);
    if (!this.stripe) throw new Error('Stripe not configured');
    try {
      const product = await this.stripe.products.create({
        name: dto.name,
      });

      const price = await this.stripe.prices.create({
        unit_amount: Math.round(dto.amount * 100),
        currency: dto.currency || 'usd',
        recurring: { interval: dto.interval as any },
        product: product.id,
      });

      return {
        planCode: price.id,
        name: dto.name,
        amount: dto.amount,
        interval: dto.interval,
      };
    } catch (error: any) {
      this.logger.error(`Stripe createPlan failed: ${error.message}`);
      throw error;
    }
  }

  verifyWebhookSignature(
    signature: string,
    payload: any,
    secret: string, // In case passed dynamically, but we use this.webhookSecret usually
  ): boolean {
    const endpointSecret = secret || this.webhookSecret;
    if (!this.stripe) {
      this.logger.warn('Stripe not configured, cannot verify webhook');
      return false;
    }
    try {
      this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      return true;
    } catch (err: any) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      return false;
    }
  }

  async handleWebhookEvent(event: any): Promise<void> {
    this.logger.log(
      `Hit stripe handleWebhookEvent args=${JSON.stringify(event)}`,
    );

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await this.handleCheckoutSessionCompleted(session);
        break;

      default:
        this.logger.log(`Unhandled event type ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    this.logger.log(`Processing checkout.session.completed for ${session.id}`);
    validateWith(StripeCheckoutSessionSchema, session);

    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.warn('No userId in session metadata');
      return;
    }

    if (session.payment_status === 'paid') {
      const amount = (session.amount_total || 0) / 100;
      await this.walletOperationsQueue.add(WALLET_JOB_NAMES.DEPOSIT, {
        userId,
        amount,
      });
      this.logger.log(`Queued deposit for user ${userId}: ${amount}`);
    }
  }
}
