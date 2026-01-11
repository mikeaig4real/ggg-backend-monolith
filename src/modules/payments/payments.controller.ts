import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Patch,
  Delete,
  Req,
  Logger,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitializeDepositDto } from './dto/initialize-deposit.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateFundingPackageDto } from './dto/create-funding-package.dto';
import { UpdateFundingPackageDto } from './dto/update-funding-package.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { type FastifyRequest } from 'fastify';
import {
  PAYMENTS_WEBHOOK_QUEUE,
  validateWith,
  PaymentProviderNameSchema,
  Roles,
  AccountType,
  CurrentUser,
  type CurrentUserPayload,
} from '@app/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(
    private readonly paymentsService: PaymentsService,
    @InjectQueue(PAYMENTS_WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  @Post('initialize-deposit')
  @UseGuards(JwtAuthGuard)
  async initializeDeposit(
    @Body() dto: InitializeDepositDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: initializeDeposit user=${user._id} amount=${dto.amount}`,
    );
    return this.paymentsService.initializeDeposit({
      ...dto,
      userId: user._id.toString(),
      email: user.email,
    });
  }

  @Get('verify/:reference')
  @UseGuards(JwtAuthGuard)
  async verifyPayment(
    @Param('reference') reference: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: verifyPayment user=${user._id} reference=${reference}`,
    );
    return this.paymentsService.verifyPayment(reference);
  }

  @Post('plans')
  @UseGuards(JwtAuthGuard)
  async createPlan(
    @Body() dto: CreatePlanDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: createPlan user=${user._id} name=${dto.name}`,
    );
    return this.paymentsService.createPlan(dto);
  }

  @Post('webhook/:provider')
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string>,
    @Req() req: FastifyRequest,
    @Body() body: any,
  ) {
    this.logger.log(`Hit endpoint: handleWebhook provider=${provider}`);
    validateWith(PaymentProviderNameSchema, provider);

    let signature = '';

    if (provider === 'stripe') {
      signature = headers['stripe-signature'];
    } else if (provider === 'paystack') {
      signature = headers['x-paystack-signature'];
    } else if (provider === 'flutterwave') {
      signature = headers['verif-hash'];
    }

    const isValid = this.paymentsService.verifyWebhookSignature(
      signature,
      body,
      provider,
    );

    if (!isValid) {
      return { status: 'failed', message: 'Invalid Signature' };
    }

    await this.webhookQueue.add('process_webhook', {
      provider,
      event: body,
      signature,
    });

    return { status: 'success' };
  }

  @Post('packages')
  @UseGuards(JwtAuthGuard)
  @Roles(AccountType.ADMIN)
  async createFundingPackage(
    @Body() dto: CreateFundingPackageDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: createFundingPackage admin=${user._id} label=${dto.label}`,
    );
    return this.paymentsService.createFundingPackage(dto);
  }

  @Get('admin/packages')
  @UseGuards(JwtAuthGuard)
  @Roles(AccountType.ADMIN)
  async getAdminFundingPackages(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: getAdminFundingPackages admin=${user._id}`);
    return this.paymentsService.getFundingPackages(false);
  }

  @Patch('packages/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(AccountType.ADMIN)
  async updateFundingPackage(
    @Param('id') id: string,
    @Body() dto: UpdateFundingPackageDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: updateFundingPackage admin=${user._id} id=${id}`,
    );
    return this.paymentsService.updateFundingPackage(id, dto);
  }

  @Delete('packages/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(AccountType.ADMIN)
  async deleteFundingPackage(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `Hit endpoint: deleteFundingPackage admin=${user._id} id=${id}`,
    );
    return this.paymentsService.deleteFundingPackage(id);
  }

  @Get('packages')
  @UseGuards(JwtAuthGuard)
  async getFundingPackages(@CurrentUser() user: CurrentUserPayload) {
    this.logger.log(`Hit endpoint: getFundingPackages user=${user._id}`);
    return this.paymentsService.getFundingPackages(true);
  }
}
