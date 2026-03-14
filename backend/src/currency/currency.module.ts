import { Module, Global } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';
import { ExchangeRateService } from './exchange-rate.service';
import { StripeModule } from '../stripe/stripe.module';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [StripeModule, RedisModule],
  providers: [CurrencyService, ExchangeRateService],
  controllers: [CurrencyController],
  exports: [CurrencyService],
})
export class CurrencyModule {}
