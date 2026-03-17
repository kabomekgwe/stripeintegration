import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripeModule } from '../stripe/stripe.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { CacheModule } from '../cache/cache.module';
import { TaxModule } from '../tax/tax.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [ConfigModule, StripeModule, PaymentMethodsModule, CacheModule, TaxModule, PricingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}