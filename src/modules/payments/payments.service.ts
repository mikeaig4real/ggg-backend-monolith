import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPaymentProvider } from './interfaces/payment-provider.interface';
import { InitializeDepositDto } from './dto/initialize-deposit.dto';
import {
  CreateTransferRecipientDto,
  InitiateTransferDto,
} from './dto/transfer.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { SendNotificationDto } from '@notifications/dto/send-notification.dto';
import { PaystackProvider } from './providers/paystack/paystack.provider';
import { StripeProvider } from './providers/stripe/stripe.provider';
import { FlutterwaveProvider } from './providers/flutterwave/flutterwave.provider';
import { validateWith, PaymentProviderNameSchema } from '@app/common';

import { CreateFundingPackageDto } from './dto/create-funding-package.dto';
import { UpdateFundingPackageDto } from './dto/update-funding-package.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FundingPackage } from './entities/funding-package.schema';

import { ControlCenterService } from '../control-center/control-center.service';

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private providers: Map<string, IPaymentProvider> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly paystack: PaystackProvider,
    private readonly stripe: StripeProvider,
    private readonly flutterwave: FlutterwaveProvider,
    @InjectModel(FundingPackage.name)
    private readonly fundingPackageModel: Model<FundingPackage>,
    private readonly controlCenterService: ControlCenterService,
  ) {}

  async onModuleInit() {
    // Register providers
    this.registerProvider(this.stripe);
    this.registerProvider(this.paystack);
    this.registerProvider(this.flutterwave);

    await this.getActiveProvider();
  }

  private registerProvider(provider: IPaymentProvider) {
    this.providers.set(provider.getName(), provider);
  }

  async getActiveProvider(): Promise<IPaymentProvider> {
    const config = await this.controlCenterService.getDomainConfig('payments');
    let strategy = 'paystack';

    if (config && config.providerStates) {
      for (const [key, state] of config.providerStates) {
        if (state.isDefault && state.enabled) {
          strategy = key;
          break;
        }
      }
    } else {
      strategy = this.configService.get<string>('PAYMENT_STRATEGY', 'paystack');
    }

    const provider = this.providers.get(strategy);
    if (!provider) {
      this.logger.error(
        `Active Payment Strategy '${strategy}' not found or not registered.`,
      );

      if (this.providers.size > 0) {
        const first = this.providers.values().next().value;
        this.logger.warn(`Falling back to ${first.getName()}`);
        return first;
      }
      throw new Error(`Active Payment Strategy '${strategy}' not found`);
    }
    return provider;
  }

  async getProvider(name?: string): Promise<IPaymentProvider> {
    this.logger.log(
      `Hit Service: getProvider args=${JSON.stringify({ name })}`,
    );
    if (name) {
      const validatedName = validateWith(PaymentProviderNameSchema, name);
      const provider = this.providers.get(validatedName);
      if (!provider) throw new Error(`Provider ${name} not found`);
      return provider;
    }
    return this.getActiveProvider();
  }

  async initializeDeposit(dto: InitializeDepositDto) {
    this.logger.log(
      `Hit Service: initializeDeposit args=${JSON.stringify(dto)}`,
    );
    const provider = await this.getActiveProvider();
    return provider.initializePayment(dto);
  }

  async verifyPayment(reference: string) {
    this.logger.log(
      `Hit Service: verifyPayment args=${JSON.stringify({ reference })}`,
    );
    const provider = await this.getActiveProvider();
    return provider.verifyPayment(reference);
  }

  async createTransferRecipient(dto: CreateTransferRecipientDto) {
    this.logger.log(
      `Hit Service: createTransferRecipient args=${JSON.stringify(dto)}`,
    );
    const provider = await this.getActiveProvider();
    return provider.createTransferRecipient(dto);
  }

  async initiateTransfer(dto: InitiateTransferDto) {
    this.logger.log(
      `Hit Service: initiateTransfer args=${JSON.stringify(dto)}`,
    );
    const provider = await this.getActiveProvider();
    return provider.initiateTransfer(dto);
  }

  async createPlan(dto: CreatePlanDto) {
    this.logger.log(`Hit Service: createPlan args=${JSON.stringify(dto)}`);
    const provider = await this.getActiveProvider();
    return provider.createPlan(dto);
  }

  async verifyWebhookSignature(
    signature: string,
    payload: any,
    providerName: string,
  ): Promise<boolean> {
    this.logger.log(
      `Hit Service: verifyWebhookSignature args=${JSON.stringify({ providerName })}`,
    );
    const provider = await this.getProvider(providerName);
    const secret = this.configService.get<string>(
      `${providerName.toUpperCase()}_WEBHOOK_SECRET`,
    );
    if (!secret) {
      this.logger.error(`Webhook secret for ${providerName} not configured`);
      return false;
    }
    return provider.verifyWebhookSignature(signature, payload, secret);
  }

  async createFundingPackage(
    dto: CreateFundingPackageDto,
  ): Promise<FundingPackage> {
    this.logger.log(
      `Hit Service: createFundingPackage args=${JSON.stringify(dto)}`,
    );
    const pkg = new this.fundingPackageModel(dto);
    return pkg.save();
  }

  async updateFundingPackage(
    id: string,
    dto: UpdateFundingPackageDto,
  ): Promise<FundingPackage> {
    this.logger.log(
      `Hit Service: updateFundingPackage args=${JSON.stringify({ id, dto })}`,
    );
    const updated = await this.fundingPackageModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!updated) {
      throw new BadRequestException('Funding package not found');
    }
    return updated;
  }

  async deleteFundingPackage(id: string): Promise<void> {
    this.logger.log(
      `Hit Service: deleteFundingPackage args=${JSON.stringify({ id })}`,
    );
    const result = await this.fundingPackageModel.findByIdAndDelete(id);
    if (!result) {
      throw new BadRequestException('Funding package not found');
    }
  }

  async getFundingPackages(activeOnly = true): Promise<FundingPackage[]> {
    this.logger.log(
      `Hit Service: getFundingPackages args=${JSON.stringify({ activeOnly })}`,
    );
    const filter = activeOnly ? { isActive: true } : {};
    return this.fundingPackageModel.find(filter).sort({ amount: 1 }).exec();
  }
}
