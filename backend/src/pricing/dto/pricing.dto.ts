import { ApiProperty } from '@nestjs/swagger';

export class PricingTierDto {
  @ApiProperty({ description: 'Pricing tier name', example: 'Tier 1 - High Income' })
  name: string;

  @ApiProperty({ description: 'Price multiplier (0-1)', example: 1.0 })
  multiplier: number;

  @ApiProperty({ description: 'Discount percentage', example: 0 })
  discountPercent: number;

  @ApiProperty({ description: 'Countries in this tier', example: ['US', 'CA', 'GB'] })
  countries: string[];
}

export class PricingCalculationDto {
  @ApiProperty({ description: 'Original amount in cents' })
  originalAmount: number;

  @ApiProperty({ description: 'Adjusted amount in cents' })
  adjustedAmount: number;

  @ApiProperty({ description: 'Applied multiplier' })
  multiplier: number;

  @ApiProperty({ description: 'Discount percentage' })
  discountPercent: number;

  @ApiProperty({ description: 'Pricing tier name' })
  tierName: string;

  @ApiProperty({ description: 'Country code' })
  countryCode: string;

  @ApiProperty({ description: 'Currency' })
  currency: string;
}

export class PricingPreviewDto {
  @ApiProperty({ description: 'Original price' })
  originalPrice: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Adjusted price after PPP discount' })
  adjustedPrice: number;

  @ApiProperty({ description: 'Discount percentage applied' })
  discountPercent: number;

  @ApiProperty({ description: 'Pricing tier' })
  tier: PricingTierDto;

  @ApiProperty({ description: 'Savings amount in cents' })
  savings: number;

  @ApiProperty({ description: 'Country detected' })
  country: string;
}