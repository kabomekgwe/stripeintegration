import { Injectable, Logger } from '@nestjs/common';

export interface PricingPreviewDto {
  originalPrice: number;
  currency: string;
  country: string;
}

/**
 * Simple Pricing Service
 *
 * Returns pricing information without PPP adjustments, discounts, or tiers.
 */
@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  /**
   * Get pricing preview (no adjustments)
   */
  getPricingPreview(
    amount: number,
    countryCode: string,
    currency: string = 'usd',
  ): PricingPreviewDto {
    return {
      originalPrice: amount,
      currency: currency.toLowerCase(),
      country: countryCode.toUpperCase(),
    };
  }
}
