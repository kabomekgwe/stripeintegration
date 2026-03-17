import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExchangeRateService } from './exchange-rate.service';

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  stripeCode: string;
  minAmount: number; // in cents
  maxAmount: number; // in cents
  supportedPaymentMethods: string[];
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly exchangeRates: Map<string, number> = new Map();
  private lastRateUpdate: Date | null = null;

  // Supported currencies configuration
  private readonly currencies: Map<string, CurrencyConfig> = new Map([
    ['usd', {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      stripeCode: 'usd',
      minAmount: 50, // $0.50
      maxAmount: 99999999, // $999,999.99
      supportedPaymentMethods: ['card', 'us_bank_account', 'link'],
    }],
    ['eur', {
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      stripeCode: 'eur',
      minAmount: 50, // €0.50
      maxAmount: 99999999,
      supportedPaymentMethods: ['card', 'sepa_debit', 'link'],
    }],
    ['gbp', {
      code: 'GBP',
      name: 'British Pound',
      symbol: '£',
      stripeCode: 'gbp',
      minAmount: 30, // £0.30
      maxAmount: 99999999,
      supportedPaymentMethods: ['card', 'bacs_debit', 'link'],
    }],
    ['cad', {
      code: 'CAD',
      name: 'Canadian Dollar',
      symbol: 'C$',
      stripeCode: 'cad',
      minAmount: 50,
      maxAmount: 99999999,
      supportedPaymentMethods: ['card', 'link'],
    }],
    ['aud', {
      code: 'AUD',
      name: 'Australian Dollar',
      symbol: 'A$',
      stripeCode: 'aud',
      minAmount: 50,
      maxAmount: 99999999,
      supportedPaymentMethods: ['card', 'link'],
    }],
    ['jpy', {
      code: 'JPY',
      name: 'Japanese Yen',
      symbol: '¥',
      stripeCode: 'jpy',
      minAmount: 50, // ¥50 (no decimals)
      maxAmount: 99999999,
      supportedPaymentMethods: ['card', 'link'],
    }],
    ['zar', {
      code: 'ZAR',
      name: 'South African Rand',
      symbol: 'R',
      stripeCode: 'zar',
      minAmount: 50, // R0.50
      maxAmount: 99999999,
      supportedPaymentMethods: ['card'],
    }],
  ]);

  constructor(
    private readonly configService: ConfigService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {
    this.initializeExchangeRates();
  }

  private async initializeExchangeRates(): Promise<void> {
    // Try to get cached rates first
    const cachedRates = await this.exchangeRateService.getCachedRates();

    if (cachedRates) {
      this.exchangeRates.clear();
      for (const [code, rate] of Object.entries(cachedRates)) {
        this.exchangeRates.set(code.toLowerCase(), rate);
      }
      this.lastRateUpdate = new Date();
      this.logger.log('Loaded exchange rates from cache');
      return;
    }

    // Fetch fresh rates from Stripe
    const success = await this.exchangeRateService.refreshRates();

    if (success) {
      const freshRates = await this.exchangeRateService.getCachedRates();
      if (freshRates) {
        this.exchangeRates.clear();
        for (const [code, rate] of Object.entries(freshRates)) {
          this.exchangeRates.set(code.toLowerCase(), rate);
        }
        this.lastRateUpdate = new Date();
      }
    } else {
      // Fallback to static rates
      this.logger.warn('Using fallback exchange rates');
      this.exchangeRates.set('usd', 1.0);
      this.exchangeRates.set('eur', 0.85);
      this.exchangeRates.set('gbp', 0.73);
      this.exchangeRates.set('cad', 1.25);
      this.exchangeRates.set('aud', 1.35);
      this.exchangeRates.set('jpy', 110.0);
      this.lastRateUpdate = new Date();
    }
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): CurrencyConfig[] {
    return Array.from(this.currencies.values());
  }

  /**
   * Get currency configuration
   */
  getCurrency(code: string): CurrencyConfig | undefined {
    return this.currencies.get(code.toLowerCase());
  }

  /**
   * Check if currency is supported
   */
  isSupported(code: string): boolean {
    return this.currencies.has(code.toLowerCase());
  }

  /**
   * Validate amount for currency
   */
  validateAmount(amount: number, currencyCode: string): { valid: boolean; error?: string } {
    const currency = this.getCurrency(currencyCode);
    if (!currency) {
      return { valid: false, error: `Currency ${currencyCode} is not supported` };
    }

    if (amount < currency.minAmount) {
      return { 
        valid: false, 
        error: `Amount must be at least ${currency.symbol}${(currency.minAmount / 100).toFixed(2)} ${currency.code}` 
      };
    }

    if (amount > currency.maxAmount) {
      return { 
        valid: false, 
        error: `Amount cannot exceed ${currency.symbol}${(currency.maxAmount / 100).toFixed(2)} ${currency.code}` 
      };
    }

    return { valid: true };
  }

  /**
   * Convert amount between currencies
   */
  convert(amount: number, from: string, to: string): number {
    if (from.toLowerCase() === to.toLowerCase()) {
      return amount;
    }

    const fromRate = this.exchangeRates.get(from.toLowerCase());
    const toRate = this.exchangeRates.get(to.toLowerCase());

    if (!fromRate || !toRate) {
      throw new Error(`Exchange rate not available for ${from} or ${to}`);
    }

    // Convert to USD first, then to target currency
    const amountInUSD = amount / fromRate;
    const convertedAmount = amountInUSD * toRate;

    // Round based on currency (JPY has no decimals)
    if (to.toLowerCase() === 'jpy') {
      return Math.round(convertedAmount);
    }

    return Math.round(convertedAmount);
  }

  /**
   * Get exchange rate
   */
  getExchangeRate(from: string, to: string): number {
    if (from.toLowerCase() === to.toLowerCase()) {
      return 1;
    }

    const fromRate = this.exchangeRates.get(from.toLowerCase());
    const toRate = this.exchangeRates.get(to.toLowerCase());

    if (!fromRate || !toRate) {
      throw new Error(`Exchange rate not available`);
    }

    return toRate / fromRate;
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: number, currencyCode: string): string {
    const currency = this.getCurrency(currencyCode);
    if (!currency) {
      return `${amount} ${currencyCode.toUpperCase()}`;
    }

    // JPY has no decimal places
    if (currencyCode.toLowerCase() === 'jpy') {
      return `${currency.symbol}${amount} ${currency.code}`;
    }

    return `${currency.symbol}${(amount / 100).toFixed(2)} ${currency.code}`;
  }

  /**
   * Get supported payment methods for currency
   */
  getSupportedPaymentMethods(currencyCode: string): string[] {
    const currency = this.getCurrency(currencyCode);
    return currency?.supportedPaymentMethods || ['card'];
  }

  /**
   * Get default currency
   */
  getDefaultCurrency(): string {
    return this.configService.get<string>('DEFAULT_CURRENCY') || 'usd';
  }

  /**
   * Get currency from country code (ISO 3166-1 alpha-2)
   */
  getCurrencyFromCountry(countryCode: string): string {
    const countryToCurrency: Record<string, string> = {
      // North America
      'US': 'usd',
      'CA': 'cad',
      'MX': 'mxn',
      // Europe
      'GB': 'gbp',
      'DE': 'eur',
      'FR': 'eur',
      'IT': 'eur',
      'ES': 'eur',
      'NL': 'eur',
      'BE': 'eur',
      'AT': 'eur',
      'IE': 'eur',
      'PT': 'eur',
      'FI': 'eur',
      'GR': 'eur',
      'CY': 'eur',
      'MT': 'eur',
      'SK': 'eur',
      'SI': 'eur',
      'EE': 'eur',
      'LV': 'eur',
      'LT': 'eur',
      'LU': 'eur',
      'CH': 'chf',
      'NO': 'nok',
      'SE': 'sek',
      'DK': 'dkk',
      'PL': 'pln',
      'CZ': 'czk',
      'HU': 'huf',
      'RO': 'ron',
      'BG': 'bgn',
      'HR': 'hrk',
      'RS': 'rsd',
      // Asia-Pacific
      'JP': 'jpy',
      'AU': 'aud',
      'NZ': 'nzd',
      'SG': 'sgd',
      'HK': 'hkd',
      'KR': 'krw',
      'CN': 'cny',
      'IN': 'inr',
      'TH': 'thb',
      'MY': 'myr',
      'ID': 'idr',
      'PH': 'php',
      'VN': 'vnd',
      // Middle East
      'AE': 'aed',
      'SA': 'sar',
      'IL': 'ils',
      'QA': 'qar',
      'KW': 'kwd',
      'BH': 'bhd',
      'OM': 'omr',
      // Africa
      'ZA': 'zar',
      'EG': 'egp',
      'NG': 'ngn',
      'KE': 'kes',
      'GH': 'ghs',
      // South America
      'BR': 'brl',
      'AR': 'ars',
      'CL': 'clp',
      'CO': 'cop',
      'PE': 'pen',
      'UY': 'uyu',
    };

    return countryToCurrency[countryCode.toUpperCase()] || 'usd';
  }

  /**
   * Suggest currency based on user country
   */
  suggestCurrencyForUser(countryCode?: string): { currency: string; source: string } {
    if (!countryCode) {
      return { currency: 'usd', source: 'default' };
    }

    const currency = this.getCurrencyFromCountry(countryCode);
    const isSupported = this.isSupported(currency);
    
    if (isSupported) {
      return { currency, source: 'country' };
    }
    
    // If currency not supported, fallback to USD
    return { currency: 'usd', source: 'default' };
  }

  /**
   * Get last rate update time
   */
  getLastRateUpdate(): Date | null {
    return this.lastRateUpdate;
  }
}
