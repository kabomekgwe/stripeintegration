import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';
import { RedisService } from '../redis/redis.service';

interface ExchangeRateResponse {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

@Injectable()
export class ExchangeRateService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly CACHE_KEY = 'exchange:rates';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.logger.log('ExchangeRateService initialized with Stripe');
  }

  async fetchLatestRates(): Promise<ExchangeRateResponse | null> {
    try {
      // Use Stripe's Exchange Rates API
      const rates = await this.stripeService.getExchangeRates();
      
      return {
        base: 'USD',
        rates,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates from Stripe:', error.message);
      return null;
    }
  }

  async getCachedRates(): Promise<Record<string, number> | null> {
    const cached = await this.redisService.get(this.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  async cacheRates(rates: Record<string, number>): Promise<void> {
    await this.redisService.set(
      this.CACHE_KEY,
      JSON.stringify(rates),
      this.CACHE_TTL,
    );
  }

  async refreshRates(): Promise<boolean> {
    const rates = await this.fetchLatestRates();
    if (rates) {
      await this.cacheRates(rates.rates);
      this.logger.log('Exchange rates refreshed successfully from Stripe');
      return true;
    }
    return false;
  }
}
