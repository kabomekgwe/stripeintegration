import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';
import { ExchangeRateService } from './exchange-rate.service';
import { CurrencyProcessor } from './currency.processor';
import { StripeModule } from '../stripe/stripe.module';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [
    StripeModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'currency',
      redis: process.env.REDIS_URL || {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
  ],
  providers: [CurrencyService, ExchangeRateService, CurrencyProcessor],
  controllers: [CurrencyController],
  exports: [CurrencyService],
})
export class CurrencyModule {}
