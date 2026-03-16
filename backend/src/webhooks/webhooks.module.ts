import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { StripeModule } from '../stripe/stripe.module';
import { SubscriptionModule } from '../subscriptions/subscription.module';
import { DisputeModule } from '../disputes/dispute.module';
import { ConnectModule } from '../connect/connect.module';

@Module({
  imports: [StripeModule, SubscriptionModule, DisputeModule, ConnectModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
