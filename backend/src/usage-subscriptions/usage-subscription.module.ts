import { Module } from '@nestjs/common';
import { UsageSubscriptionController } from './usage-subscription.controller';
import { UsageSubscriptionService } from './usage-subscription.service';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [StripeModule],
  controllers: [UsageSubscriptionController],
  providers: [UsageSubscriptionService],
  exports: [UsageSubscriptionService],
})
export class UsageSubscriptionModule {}
