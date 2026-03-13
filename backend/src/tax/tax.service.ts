import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TaxCalculationInput {
  amount: number;
  currency: string;
  customerId?: string;
  customerDetails?: {
    address: {
      line1: string;
      city?: string;
      state?: string;
      postal_code: string;
      country: string;
    };
    name?: string;
    email?: string;
  };
  taxId?: string;
}

export interface TaxCalculationResult {
  taxAmount: number;
  taxRate: number;
  taxDisplayName?: string;
  totalAmount: number;
  inclusive: boolean;
  jurisdiction?: string;
}

export interface TaxPreviewResult {
  items: Array<{
    amount: number;
    taxAmount: number;
    taxRate: number;
    taxDisplayName?: string;
  }>;
  subtotal: number;
  taxTotal: number;
  total: number;
}

interface TaxRate {
  country: string;
  state?: string;
  rate: number;
  displayName: string;
}

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);
  private readonly taxRates: TaxRate[] = [
    // US States
    { country: 'US', state: 'CA', rate: 0.0725, displayName: 'CA Sales Tax' },
    { country: 'US', state: 'NY', rate: 0.08, displayName: 'NY Sales Tax' },
    { country: 'US', state: 'TX', rate: 0.0625, displayName: 'TX Sales Tax' },
    { country: 'US', state: 'FL', rate: 0.06, displayName: 'FL Sales Tax' },
    // EU Countries
    { country: 'DE', rate: 0.19, displayName: 'DE VAT' },
    { country: 'FR', rate: 0.20, displayName: 'FR VAT' },
    { country: 'GB', rate: 0.20, displayName: 'UK VAT' },
    { country: 'IT', rate: 0.22, displayName: 'IT VAT' },
    { country: 'ES', rate: 0.21, displayName: 'ES VAT' },
    // Default
    { country: '*', rate: 0, displayName: 'No Tax' },
  ];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if Stripe Tax is enabled
   */
  isTaxEnabled(): boolean {
    return this.configService.get<boolean>('STRIPE_TAX_ENABLED') || false;
  }

  /**
   * Calculate tax for a transaction
   */
  async calculateTax(
    input: TaxCalculationInput,
  ): Promise<TaxCalculationResult> {
    if (!this.isTaxEnabled()) {
      return {
        taxAmount: 0,
        taxRate: 0,
        totalAmount: input.amount,
        inclusive: false,
      };
    }

    try {
      const taxRate = this.getTaxRate(input.customerDetails?.address);
      const taxAmount = Math.round(input.amount * taxRate.rate);

      return {
        taxAmount,
        taxRate: taxRate.rate,
        taxDisplayName: taxRate.displayName,
        totalAmount: input.amount + taxAmount,
        inclusive: false,
        jurisdiction: this.getJurisdictionName(input.customerDetails?.address),
      };
    } catch (error) {
      this.logger.error('Failed to calculate tax:', error);
      // Return zero tax on failure
      return {
        taxAmount: 0,
        taxRate: 0,
        totalAmount: input.amount,
        inclusive: false,
      };
    }
  }

  /**
   * Preview tax for a cart with multiple items
   */
  async previewCartTax(
    items: Array<{ amount: number; description?: string }>,
    customerDetails: TaxCalculationInput['customerDetails'],
  ): Promise<TaxPreviewResult> {
    if (!this.isTaxEnabled()) {
      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      return {
        items: items.map((item) => ({
          amount: item.amount,
          taxAmount: 0,
          taxRate: 0,
        })),
        subtotal,
        taxTotal: 0,
        total: subtotal,
      };
    }

    try {
      const taxRate = this.getTaxRate(customerDetails?.address);
      const rate = taxRate.rate;

      const resultItems = items.map((item) => {
        const taxAmount = Math.round(item.amount * rate);
        return {
          amount: item.amount,
          taxAmount,
          taxRate: rate,
          taxDisplayName: taxRate.displayName,
        };
      });

      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const taxTotal = Math.round(subtotal * rate);

      return {
        items: resultItems,
        subtotal,
        taxTotal,
        total: subtotal + taxTotal,
      };
    } catch (error) {
      this.logger.error('Failed to preview cart tax:', error);
      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      return {
        items: items.map((item) => ({
          amount: item.amount,
          taxAmount: 0,
          taxRate: 0,
        })),
        subtotal,
        taxTotal: 0,
        total: subtotal,
      };
    }
  }

  /**
   * Verify a tax ID (VAT, GST, etc.)
   * Note: Full implementation would use Stripe Tax API
   */
  async verifyTaxId(
    taxId: string,
    taxType?: 'eu_vat' | 'gb_vat' | 'au_abn' | string,
  ): Promise<{ valid: boolean; country?: string }> {
    // Simplified validation - full implementation would use Stripe Tax
    const vatRegex: Record<string, RegExp> = {
      DE: /^DE[0-9]{9}$/,
      FR: /^FR[A-Z0-9]{2}[0-9]{9}$/,
      GB: /^(GB)?[0-9]{9}(?:[0-9]{3})?$/,
      IT: /^IT[0-9]{11}$/,
    };

    if (taxType && vatRegex[taxType]) {
      const valid = vatRegex[taxType].test(taxId.toUpperCase().replace(/\s/g, ''));
      return { valid, country: taxType.toUpperCase() };
    }

    // Check against all patterns
    for (const [country, regex] of Object.entries(vatRegex)) {
      if (regex.test(taxId.toUpperCase().replace(/\s/g, ''))) {
        return { valid: true, country };
      }
    }

    return { valid: false };
  }

  /**
   * Get tax settings
   */
  async getTaxSettings(): Promise<{
    enabled: boolean;
    defaultTaxCode?: string;
    originCountry?: string;
  }> {
    return {
      enabled: this.isTaxEnabled(),
      defaultTaxCode: 'txcd_10000000',
      originCountry: 'US',
    };
  }

  private getTaxRate(address?: { country: string; state?: string }): TaxRate {
    if (!address?.country) {
      return this.taxRates.find((r) => r.country === '*')!;
    }

    // Try to find specific state rate for US
    if (address.country === 'US' && address.state) {
      const stateRate = this.taxRates.find(
        (r) => r.country === 'US' && r.state === address.state,
      );
      if (stateRate) return stateRate;
    }

    // Try to find country rate
    const countryRate = this.taxRates.find((r) => r.country === address.country);
    if (countryRate) return countryRate;

    // Return default
    return this.taxRates.find((r) => r.country === '*')!;
  }

  private getJurisdictionName(address?: { country: string; state?: string }): string {
    if (!address?.country) return 'Unknown';

    const countryName: Record<string, string> = {
      US: 'United States',
      DE: 'Germany',
      FR: 'France',
      GB: 'United Kingdom',
      IT: 'Italy',
      ES: 'Spain',
    };

    if (address.country === 'US' && address.state) {
      return `${address.country} (${address.state})`;
    }

    return countryName[address.country] || address.country;
  }
}
