import { Controller, Get, Query } from '@nestjs/common';
import { CurrencyService } from './currency.service';

@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get()
  getSupportedCurrencies() {
    const currencies = this.currencyService.getSupportedCurrencies();
    const defaultCurrency = this.currencyService.getDefaultCurrency();
    
    return {
      currencies: currencies.map(c => ({
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        minAmount: c.minAmount,
        maxAmount: c.maxAmount,
      })),
      default: defaultCurrency.toUpperCase(),
    };
  }

  @Get('convert')
  convertAmount(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum)) {
      return { error: 'Invalid amount' };
    }

    try {
      const converted = this.currencyService.convert(amountNum, from, to);
      const rate = this.currencyService.getExchangeRate(from, to);
      
      return {
        original: {
          amount: amountNum,
          currency: from.toUpperCase(),
          formatted: this.currencyService.formatAmount(amountNum, from),
        },
        converted: {
          amount: converted,
          currency: to.toUpperCase(),
          formatted: this.currencyService.formatAmount(converted, to),
        },
        rate,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  @Get('exchange-rates')
  getExchangeRates(@Query('base') base: string = 'usd') {
    const currencies = this.currencyService.getSupportedCurrencies();
    const rates: Record<string, number> = {};

    for (const currency of currencies) {
      if (currency.code.toLowerCase() !== base.toLowerCase()) {
        try {
          rates[currency.code] = this.currencyService.getExchangeRate(base, currency.code);
        } catch {
          // Skip if rate not available
        }
      }
    }

    return {
      base: base.toUpperCase(),
      rates,
      lastUpdate: this.currencyService.getLastRateUpdate(),
    };
  }
}
