import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { StripeModule } from './stripe/stripe.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { PaymentsModule } from './payments/payments.module';
import { UsageModule } from './usage/usage.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { InvoiceModule } from './invoices/invoice.module';
import { TaxModule } from './tax/tax.module';
import { AdminModule } from './admin/admin.module';
import { SubscriptionModule } from './subscriptions/subscription.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { CurrencyModule } from './currency/currency.module';
import { PromoCodeModule } from './promo-codes/promo-code.module';
import { UsageSubscriptionModule } from './usage-subscriptions/usage-subscription.module';
import { DisputeModule } from './disputes/dispute.module';
import { ConnectModule } from './connect/connect.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { GlobalRateLimitMiddleware } from './common/middleware/global-rate-limit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    StripeModule,
    MailModule,
    AuthModule,
    UsersModule,
    PaymentMethodsModule,
    PaymentsModule,
    UsageModule,
    WebhooksModule,
    InvoiceModule,
    TaxModule,
    AdminModule,
    SubscriptionModule,
    CustomerPortalModule,
    CurrencyModule,
    PromoCodeModule,
    UsageSubscriptionModule,
    DisputeModule,
    ConnectModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {
  /**
   * Configure global middleware.
   * Applies rate limiting to all routes except health checks.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(GlobalRateLimitMiddleware)
      .forRoutes('*');
  }
}
