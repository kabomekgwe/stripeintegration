import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { ExchangeRateService } from './exchange-rate.service';

@Processor('currency')
export class CurrencyProcessor {
  private readonly logger = new Logger(CurrencyProcessor.name);

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Process('refresh-rates')
  async handleRefreshRates(job: Job) {
    this.logger.log(`Processing job ${job.id}: refresh-rates`);
    
    const success = await this.exchangeRateService.refreshRates();
    
    if (success) {
      this.logger.log('Exchange rates refreshed successfully from Stripe');
    } else {
      this.logger.error('Failed to refresh exchange rates');
      throw new Error('Rate refresh failed');
    }
  }
}
