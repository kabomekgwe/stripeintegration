import { Module } from '@nestjs/common';
import { UsageSubscriptionController } from './usage-subscription.controller';
import { UsageSubscriptionService } from './usage-subscription.service';

@Module({
  controllers: [UsageSubscriptionController],
  providers: [UsageSubscriptionService],
  exports: [UsageSubscriptionService],
})
export class UsageSubscriptionModule {}
