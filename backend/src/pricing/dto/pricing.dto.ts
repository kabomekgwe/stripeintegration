import { ApiProperty } from '@nestjs/swagger';

export class PricingPreviewDto {
  @ApiProperty({ description: 'Original price' })
  originalPrice: number;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Country detected' })
  country: string;
}
