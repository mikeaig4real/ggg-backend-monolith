import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsProcessor } from './payments.processor';
import { WalletModule } from '@modules/wallet/wallet.module';
import { UsersModule } from '@modules/users/users.module';
import { PaystackProvider } from './providers/paystack/paystack.provider';
import { StripeProvider } from './providers/stripe/stripe.provider';
import { FlutterwaveProvider } from './providers/flutterwave/flutterwave.provider';
import { PAYMENTS_WEBHOOK_QUEUE, WALLET_OPERATIONS_QUEUE } from '@app/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  FundingPackage,
  FundingPackageSchema,
} from './entities/funding-package.schema';
import { ControlCenterModule } from '../control-center/control-center.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    HttpModule,
    WalletModule,
    UsersModule,
    BullModule.registerQueue({
      name: PAYMENTS_WEBHOOK_QUEUE,
    }),
    BullModule.registerQueue({
      name: WALLET_OPERATIONS_QUEUE,
    }),
    MongooseModule.forFeature([
      { name: FundingPackage.name, schema: FundingPackageSchema },
    ]),
    ControlCenterModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsProcessor,
    PaystackProvider,
    StripeProvider,
    FlutterwaveProvider,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
