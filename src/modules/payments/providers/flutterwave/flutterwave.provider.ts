import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
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
  FlutterwaveChargeCompletedSchema,
} from '../../schemas/payment.schemas';
import { z } from 'zod';

@Injectable()
export class FlutterwaveProvider implements IPaymentProvider {
  private readonly logger = new Logger(FlutterwaveProvider.name);
  private readonly baseUrl = 'https://api.flutterwave.com/v3';
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectQueue(WALLET_OPERATIONS_QUEUE)
    private readonly walletOperationsQueue: Queue,
  ) {
    this.secretKey =
      this.configService.get<string>('FLUTTERWAVE_SECRET_KEY') || '';
    this.webhookSecret =
      this.configService.get<string>('FLUTTERWAVE_SECRET_HASH') || '';

    if (!this.secretKey) {
      this.logger.warn('FLUTTERWAVE_SECRET_KEY not configured');
    }
  }

  getName(): string {
    return 'flutterwave';
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
      `Hit flutterwave initializePayment args=${JSON.stringify(dto)}`,
    );
    validateWith(InitializeDepositSchema, dto);
    try {
      const payload = {
        tx_ref: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        amount: dto.amount,
        currency: dto.currency || 'NGN',
        redirect_url: dto.callbackUrl,
        customer: {
          email: dto.email,
        },
        meta: {
          userId: dto.metadata?.userId,
          ...dto.metadata,
        },
        customizations: {
          title: 'ggg Deposit',
        },
      };

      const response = (await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/payments`, payload, {
          headers: this.headers,
        }),
      )) as AxiosResponse<any>;

      const data = response.data;

      if (data.status === 'success') {
        return {
          reference: payload.tx_ref,
          authorizationUrl: data.data.link,
        };
      } else {
        throw new Error(data.message || 'Failed to initialize payment');
      }
    } catch (error: any) {
      this.logger.error(
        `Flutterwave initializePayment failed: ${error.response?.data?.message || error.message}`,
      );
      throw error;
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    this.logger.log(
      `Hit flutterwave verifyPayment args=${JSON.stringify({ reference })}`,
    );
    validateWith(z.string(), reference);
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/transactions/verify_by_reference?tx_ref=${reference}`,
          { headers: this.headers },
        ),
      );

      const data = response.data;
      const txData = data.data;

      let status: 'success' | 'failed' | 'pending' = 'pending';
      if (
        data.status === 'success' &&
        txData.status === 'successful' &&
        txData.amount >= 0
      ) {
        status = 'success';
      } else if (txData.status === 'failed') {
        status = 'failed';
      }

      return {
        status,
        reference: txData.tx_ref,
        amount: txData.amount,
        currency: txData.currency,
        metadata: txData.meta,
      };
    } catch (error: any) {
      this.logger.error(
        `Flutterwave verifyPayment failed: ${error.response?.data?.message || error.message}`,
      );
      throw error;
    }
  }

  async createTransferRecipient(
    dto: CreateTransferRecipientDto,
  ): Promise<TransferRecipientResponse> {
    this.logger.log(
      `Hit flutterwave createTransferRecipient args=${JSON.stringify(dto)}`,
    );
    validateWith(CreateTransferRecipientSchema, dto);
    try {
      const payload = {
        account_bank: dto.bankCode,
        account_number: dto.accountNumber,
        business_name: dto.name,
        description: 'Transfer Recipient',
        currency: dto.currency || 'NGN',
        type: 'nuban',
      };

      const response = (await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/beneficiaries`, payload, {
          headers: this.headers,
        }),
      )) as AxiosResponse<any>;

      const data = response.data;
      return {
        recipientCode: data.data.id.toString(),
        details: data.data,
      };
    } catch (error: any) {
      this.logger.error(`Flutterwave recipient failed: ${error.message}`);
      throw error;
    }
  }

  async initiateTransfer(dto: InitiateTransferDto): Promise<TransferResponse> {
    this.logger.log(
      `Hit flutterwave initiateTransfer args=${JSON.stringify(dto)}`,
    );
    validateWith(InitiateTransferSchema, dto);
    try {
      const payload = {
        account_bank: '',
        amount: dto.amount,
        currency: 'NGN',
        narration: dto.reason,
        reference: dto.reference,
        beneficiary: Number(dto.recipientCode),
      };

      const response = (await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/transfers`, payload, {
          headers: this.headers,
        }),
      )) as AxiosResponse<any>;

      const data = response.data;

      return {
        reference: data.data.reference,
        status: data.data.status,
        transferCode: data.data.id.toString(),
      };
    } catch (error: any) {
      this.logger.error(`Flutterwave transfer failed: ${error.message}`);
      throw error;
    }
  }

  async createPlan(dto: CreatePlanDto): Promise<PlanResponse> {
    this.logger.log(`Hit flutterwave createPlan args=${JSON.stringify(dto)}`);
    validateWith(CreatePlanSchema, dto);

    try {
      const payload = {
        amount: dto.amount,
        name: dto.name,
        interval: dto.interval,
        currency: dto.currency || 'NGN',
      };
      const response = (await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/payment-plans`, payload, {
          headers: this.headers,
        }),
      )) as AxiosResponse<any>;

      const data = response.data;
      return {
        planCode: data.data.id.toString(),
        name: data.data.name,
        amount: data.data.amount,
        interval: data.data.interval,
      };
    } catch (error: any) {
      this.logger.error(`Flutterwave createPlan failed: ${error.message}`);
      throw error;
    }
  }

  verifyWebhookSignature(
    signature: string,
    payload: any,
    secret: string,
  ): boolean {
    const endpointSecret = secret || this.webhookSecret;
    return signature === endpointSecret;
  }

  async handleWebhookEvent(event: any): Promise<void> {
    this.logger.log(
      `Hit flutterwave handleWebhookEvent args=${JSON.stringify(event)}`,
    );

    const { event: eventType, data } = event;

    if (eventType === 'charge.completed' && data.status === 'successful') {
      this.logger.log(`Processing Flutterwave charge.completed for ${data.id}`);

      validateWith(FlutterwaveChargeCompletedSchema, event);

      const userId = data.meta?.userId;

      if (!userId) return;

      await this.walletOperationsQueue.add(WALLET_JOB_NAMES.DEPOSIT, {
        userId,
        amount: data.amount,
      });
      this.logger.log(`Queued deposit for user ${userId}`);
    }
  }
}
