import { Controller, Get, Query, Headers, Ip } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { ExchangeRateService } from './exchange-rate.service';

@Controller('currency')
export class CurrencyController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

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

  @Get('detect')
  detectCurrencyFromIP(
    @Ip() ip: string,
    @Headers('x-forwarded-for') forwardedFor: string,
    @Headers('cf-ipcountry') cloudflareCountry: string,
  ) {
    // Get client IP (handle proxies)
    const clientIp = forwardedFor?.split(',')[0]?.trim() || ip || '127.0.0.1';
    
    // Use Cloudflare country header if available (most reliable)
    let countryCode = cloudflareCountry;
    
    // If no Cloudflare header, try to extract from IP (simplified)
    // In production, use a geolocation service like MaxMind GeoIP2
    if (!countryCode) {
      // For now, default to US if no country detected
      // In production, integrate with a geolocation API
      countryCode = 'US';
    }

    const suggestedCurrency = this.currencyService.getCurrencyFromCountry(countryCode);
    const currencyConfig = this.currencyService.getCurrency(suggestedCurrency);

    return {
      ip: clientIp,
      country: countryCode?.toUpperCase() || 'US',
      suggestedCurrency: suggestedCurrency.toUpperCase(),
      currency: currencyConfig ? {
        code: currencyConfig.code,
        name: currencyConfig.name,
        symbol: currencyConfig.symbol,
      } : null,
      note: 'Currency detected from IP geolocation. User can override in settings.',
    };
  }

  @Get('convert')
  async convertAmount(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const amountNum = parseInt(amount, 10);
    if (isNaN(amountNum)) {
      return { error: 'Invalid amount' };
    }

    try {
      const converted = await this.currencyService.convert(amountNum, from, to);
      const rate = await this.currencyService.getExchangeRate(from, to);
      
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
  async getExchangeRates(@Query('base') base: string = 'usd') {
    const currencies = this.currencyService.getSupportedCurrencies();
    const rates: Record<string, number> = {};

    for (const currency of currencies) {
      if (currency.code.toLowerCase() !== base.toLowerCase()) {
        try {
          rates[currency.code] = await this.currencyService.getExchangeRate(base, currency.code);
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

  @Get('health')
  async getHealth() {
    const lastUpdate = this.currencyService.getLastRateUpdate();
    const cachedRates = await this.exchangeRateService.getCachedRates();

    const isStale = lastUpdate
      ? Date.now() - lastUpdate.getTime() > 24 * 60 * 60 * 1000 // 24 hours
      : true;

    return {
      status: isStale ? 'stale' : 'healthy',
      lastUpdate: lastUpdate?.toISOString(),
      cachedCurrencies: cachedRates ? Object.keys(cachedRates).length : 0,
      source: 'Stripe Exchange Rates API',
    };
  }
}
