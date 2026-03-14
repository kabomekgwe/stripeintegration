import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
  ],
})
export class AppModule {}
