import { Injectable, Logger } from '@nestjs/common';
import { PricingTierDto, PricingCalculationDto, PricingPreviewDto } from './dto/pricing.dto';

export { PricingPreviewDto };

/**
 * PPP (Purchasing Power Parity) Pricing Service
 *
 * Implements regional pricing based on economic indicators.
 * Tiers are based on World Bank income classifications and adjusted for
 * software/service accessibility.
 */
@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  /**
   * PPP Pricing Tiers
   * Multipliers represent the percentage of the original price users pay.
   * Based on World Bank GNI per capita and adjusted for digital goods accessibility.
   */
  private readonly pricingTiers: Record<string, PricingTierDto> = {
    tier1: {
      name: 'Tier 1 - High Income',
      multiplier: 1.00,
      discountPercent: 0,
      countries: [
        // North America
        'US', 'CA',
        // Western Europe
        'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR',
        'LU', 'MT', 'CY', 'SK', 'SI', 'EE', 'LV', 'LT',
        // Nordics
        'NO', 'SE', 'DK', 'IS',
        // Oceania
        'AU', 'NZ',
        // Asia-Pacific High Income
        'JP', 'KR', 'SG', 'HK', 'TW',
        // Middle East High Income
        'AE', 'QA', 'KW', 'BH', 'SA', 'IL',
        // Others
        'CH', 'LI', 'MC', 'AD',
      ],
    },
    tier2: {
      name: 'Tier 2 - Upper Middle Income',
      multiplier: 0.80,
      discountPercent: 20,
      countries: [
        // Eastern Europe
        'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'RS', 'MK', 'ME', 'BA', 'AL',
        // Latin America
        'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'CR', 'PA',
        // Asia
        'MY', 'TH', 'CN', 'RU', 'KZ', 'TR',
        // Africa (Upper Middle)
        'ZA', 'MU', 'SC',
      ],
    },
    tier3: {
      name: 'Tier 3 - Lower Middle Income',
      multiplier: 0.50,
      discountPercent: 50,
      countries: [
        // Asia
        'IN', 'ID', 'PH', 'VN', 'PK', 'BD', 'MM', 'KH', 'LA', 'NP', 'LK',
        // Africa
        'NG', 'EG', 'KE', 'GH', 'CI', 'SN', 'CM', 'TZ', 'UG', 'ET', 'ZW',
        // Others
        'UA', 'MD', 'GE', 'AM', 'AZ',
      ],
    },
    tier4: {
      name: 'Tier 4 - Low Income',
      multiplier: 0.30,
      discountPercent: 70,
      countries: [
        // South Asia
        'AF',
        // Sub-Saharan Africa
        'MW', 'MZ', 'MG', 'BF', 'ML', 'NE', 'TD', 'BI', 'RW', 'SO',
        // Others
        'KP', 'YE', 'SY',
      ],
    },
  };

  /**
   * Currency-specific adjustments
   * Some currencies have different purchasing power than raw PPP suggests
   */
  private readonly currencyAdjustments: Record<string, number> = {
    // Strong currencies - full price
    'usd': 1.0,
    'eur': 1.0,
    'gbp': 1.0,
    'chf': 1.0,
    'aud': 1.0,
    'cad': 1.0,
    'jpy': 1.0,
    'sgd': 1.0,
    // Moderate currencies
    'krw': 0.9,
    'cny': 0.85,
    // Weaker currencies with high inflation
    'try': 0.7,
    'ars': 0.6,
    'inr': 0.85,
  };

  /**
   * Get pricing tier for a country
   */
  getTierForCountry(countryCode: string): PricingTierDto {
    const code = countryCode.toUpperCase();

    for (const tier of Object.values(this.pricingTiers)) {
      if (tier.countries.includes(code)) {
        return tier;
      }
    }

    // Default to Tier 2 for unknown countries (conservative approach)
    this.logger.debug(`Unknown country ${code}, defaulting to Tier 2`);
    return this.pricingTiers.tier2;
  }

  /**
   * Calculate adjusted price based on country PPP
   */
  calculatePrice(
    originalAmount: number,
    countryCode: string,
    currency: string = 'usd',
  ): PricingCalculationDto {
    const tier = this.getTierForCountry(countryCode);
    const currencyAdjustment = this.currencyAdjustments[currency.toLowerCase()] || 1.0;

    // Apply tier multiplier and currency adjustment
    const effectiveMultiplier = tier.multiplier * currencyAdjustment;
    const adjustedAmount = Math.round(originalAmount * effectiveMultiplier);

    // Ensure minimum amount (50 cents in most currencies)
    const minAmount = this.getMinimumAmount(currency);
    const finalAmount = Math.max(adjustedAmount, minAmount);

    return {
      originalAmount,
      adjustedAmount: finalAmount,
      multiplier: effectiveMultiplier,
      discountPercent: Math.round((1 - effectiveMultiplier) * 100),
      tierName: tier.name,
      countryCode: countryCode.toUpperCase(),
      currency: currency.toLowerCase(),
    };
  }

  /**
   * Get pricing preview for frontend display
   */
  getPricingPreview(
    amount: number,
    countryCode: string,
    currency: string = 'usd',
  ): PricingPreviewDto {
    const calculation = this.calculatePrice(amount, countryCode, currency);
    const tier = this.getTierForCountry(countryCode);

    return {
      originalPrice: calculation.originalAmount,
      currency: calculation.currency,
      adjustedPrice: calculation.adjustedAmount,
      discountPercent: calculation.discountPercent,
      tier,
      savings: calculation.originalAmount - calculation.adjustedAmount,
      country: calculation.countryCode,
    };
  }

  /**
   * Get all pricing tiers
   */
  getAllTiers(): PricingTierDto[] {
    return Object.values(this.pricingTiers);
  }

  /**
   * Check if a country is eligible for PPP discount
   */
  hasDiscount(countryCode: string): boolean {
    const tier = this.getTierForCountry(countryCode);
    return tier.multiplier < 1.0;
  }

  /**
   * Get discount percentage for a country
   */
  getDiscountPercent(countryCode: string): number {
    const tier = this.getTierForCountry(countryCode);
    return tier.discountPercent;
  }

  /**
   * Validate country code
   */
  isValidCountryCode(code: string): boolean {
    const upperCode = code.toUpperCase();
    for (const tier of Object.values(this.pricingTiers)) {
      if (tier.countries.includes(upperCode)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get minimum amount for currency (in cents)
   */
  private getMinimumAmount(currency: string): number {
    const minimums: Record<string, number> = {
      'usd': 50,    // $0.50
      'eur': 50,    // €0.50
      'gbp': 30,    // £0.30
      'cad': 50,    // C$0.50
      'aud': 50,    // A$0.50
      'jpy': 50,    // ¥50
      'inr': 4000,  // ₹40 (adjusted for PPP)
      'brl': 250,   // R$2.50
      'mxn': 1000,  // MX$10
      'cny': 350,   // ¥3.5
    };

    return minimums[currency.toLowerCase()] || 50;
  }

  /**
   * Get pricing info for multiple countries
   */
  getPricingForCountries(
    amount: number,
    countryCodes: string[],
    currency: string = 'usd',
  ): Record<string, PricingCalculationDto> {
    const results: Record<string, PricingCalculationDto> = {};

    for (const code of countryCodes) {
      results[code.toUpperCase()] = this.calculatePrice(amount, code, currency);
    }

    return results;
  }
}