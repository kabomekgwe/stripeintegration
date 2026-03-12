import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsageService } from './usage.service';
import { UsageController, AdminBillingController } from './usage.controller';
import { StripeModule } from '../stripe/stripe.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';

@Module({
  imports: [ConfigModule, StripeModule, PaymentMethodsModule],
  controllers: [UsageController, AdminBillingController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
