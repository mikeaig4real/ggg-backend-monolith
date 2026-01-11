import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { IPaymentProvider } from '@modules/payments/interfaces/payment-provider.interface';
import {
  InitializeDepositDto,
  PaymentInitializationResponse,
  PaymentVerificationResponse,
} from '@modules/payments/dto/initialize-deposit.dto';
import {
  CreateTransferRecipientDto,
  InitiateTransferDto,
  TransferRecipientResponse,
  TransferResponse,
} from '@modules/payments/dto/transfer.dto';
import {
  CreatePlanDto,
  PlanResponse,
} from '@modules/payments/dto/create-plan.dto';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import * as crypto from 'crypto';
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
  PaystackChargeSuccessSchema,
} from '../../schemas/payment.schemas';
import { z } from 'zod';

@Injectable()
export class PaystackProvider implements IPaymentProvider {
  private readonly logger = new Logger(PaystackProvider.name);
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectQueue(WALLET_OPERATIONS_QUEUE)
    private readonly walletOperationsQueue: Queue,
  ) {
    this.secretKey =
      this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    if (!this.secretKey) this.logger.warn('PAYSTACK_SECRET_KEY not configured');
  }

  // ... imports and other methods remain same until handleWebhookEvent ...

  getName(): string {
    return 'paystack';
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initializePayment(
    dto: InitializeDepositDto,
  ): Promise<PaymentInitializationResponse> {
    this.logger.log(
      `Hit paystack initializePayment args=${JSON.stringify(dto)}`,
    );
    validateWith(InitializeDepositSchema, dto);
    try {
      const payload = {
        email: dto.email,
        amount: dto.amount * 100,
        currency: dto.currency || 'NGN',
        callback_url: dto.callbackUrl,
        metadata: {
          ...dto.metadata,
          userId: dto.userId,
        },
      };

      const response = await firstValueFrom(
        this.httpService.post<any>(
          `${this.baseUrl}/transaction/initialize`,
          payload,
          { headers: this.headers },
        ),
      );
      const data = response.data;

      return {
        reference: data.data.reference,
        authorizationUrl: data.data.authorization_url,
      };
    } catch (error: any) {
      this.logger.error(
        `Paystack initializePayment failed: ${error.response?.data?.message || error.message}`,
      );
      throw error;
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    this.logger.log(
      `Hit paystack verifyPayment args=${JSON.stringify({ reference })}`,
    );
    validateWith(z.string(), reference);
    try {
      const response = await firstValueFrom(
        this.httpService.get<any>(
          `${this.baseUrl}/transaction/verify/${reference}`,
          { headers: this.headers },
        ),
      );
      const data = response.data;

      const status = data.data.status;

      return {
        status:
          status === 'success'
            ? 'success'
            : status === 'failed'
              ? 'failed'
              : 'pending',
        reference: data.data.reference,
        amount: data.data.amount / 100,
        currency: data.data.currency,
        metadata: data.data.metadata,
      };
    } catch (error: any) {
      this.logger.error(
        `Paystack verifyPayment failed: ${error.response?.data?.message || error.message}`,
      );
      throw error;
    }
  }

  async createTransferRecipient(
    dto: CreateTransferRecipientDto,
  ): Promise<TransferRecipientResponse> {
    this.logger.log(
      `Hit paystack createTransferRecipient args=${JSON.stringify(dto)}`,
    );
    validateWith(CreateTransferRecipientSchema, dto);
    try {
      const payload = {
        type: dto.type,
        name: dto.name,
        account_number: dto.accountNumber,
        bank_code: dto.bankCode,
        currency: dto.currency || 'NGN',
      };

      const response = await firstValueFrom(
        this.httpService.post<any>(
          `${this.baseUrl}/transferrecipient`,
          payload,
          {
            headers: this.headers,
          },
        ),
      );
      const data = response.data;

      return {
        recipientCode: data.data.recipient_code,
        details: data.data.details,
      };
    } catch (error: any) {
      this.logger.error(
        `Paystack createTransferRecipient failed: ${error.response?.data?.message || error.message}`,
      );
      throw error;
    }
  }

  async initiateTransfer(dto: InitiateTransferDto): Promise<TransferResponse> {
    this.logger.log(
      `Hit paystack initiateTransfer args=${JSON.stringify(dto)}`,
    );
    validateWith(InitiateTransferSchema, dto);
    try {
      const payload = {
        source: 'balance',
        amount: dto.amount * 100,
        recipient: dto.recipientCode,
        reason: dto.reason,
        reference: dto.reference,
      };

      const response = await firstValueFrom(
        this.httpService.post<any>(`${this.baseUrl}/transfer`, payload, {
          headers: this.headers,
        }),
      );
      const data = response.data;

      return {
        reference: data.data.reference,
        status: data.data.status,
        transferCode: data.data.transfer_code,
      };
    } catch (error: any) {
      this.logger.error(
        `Paystack initiateTransfer failed: ${error.response?.data?.message || error.message}`,
      );
      throw error;
    }
  }

  async createPlan(dto: CreatePlanDto): Promise<PlanResponse> {
    this.logger.log(`Hit paystack createPlan args=${JSON.stringify(dto)}`);
    validateWith(CreatePlanSchema, dto);
    try {
      const payload = {
        name: dto.name,
        amount: dto.amount * 100,
        interval: dto.interval,
        currency: dto.currency,
      };

      const response = await firstValueFrom(
        this.httpService.post<any>(`${this.baseUrl}/plan`, payload, {
          headers: this.headers,
        }),
      );
      const data = response.data;

      return {
        planCode: data.data.plan_code,
        name: data.data.name,
        amount: data.data.amount / 100,
        interval: data.data.interval,
      };
    } catch (error: any) {
      this.logger.error(
        `Paystack createPlan failed: ${error.response?.data?.message || error.message}`,
      );
      throw error;
    }
  }

  verifyWebhookSignature(
    signature: string,
    payload: any,
    secret: string,
  ): boolean {
    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return hash === signature;
  }

  async handleWebhookEvent(event: any): Promise<void> {
    this.logger.log(
      `Hit paystack handleWebhookEvent args=${JSON.stringify(event)}`,
    );
    const handlers: Record<string, (data: any) => Promise<void>> = {
      'charge.success': this.handleChargeSuccess.bind(this),
    };

    const handler = handlers[event.event];
    if (handler) {
      this.logger.log(`Handler found for event ${event.event}`);
      return await handler(event);
    }
    this.logger.log(`No handler found for event ${event.event}`);
  }

  private async handleChargeSuccess(event: any): Promise<void> {
    this.logger.log(
      `Handler called for event charge.success with data: ${JSON.stringify(event.data)}`,
    );
    validateWith(PaystackChargeSuccessSchema, event);
    const data = event.data;
    const { amount, metadata, reference } = data;
    const userId = metadata?.userId;

    if (!userId) {
      this.logger.warn(
        `No userId found in metadata for reference ${reference}`,
      );
      return;
    }

    const amountInMainUnit = amount / 100;

    await this.walletOperationsQueue.add(WALLET_JOB_NAMES.DEPOSIT, {
      userId,
      amount: amountInMainUnit,
      source: 'paystack',
    });

    this.logger.log(
      `Queued deposit for user ${userId} with ${amountInMainUnit}`,
    );
  }
}
