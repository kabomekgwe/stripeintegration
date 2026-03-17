import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PricingService, PricingPreviewDto } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pricing preview' })
  @ApiQuery({ name: 'amount', description: 'Amount in cents', required: true })
  @ApiQuery({ name: 'currency', description: 'Currency code', required: false })
  @ApiQuery({ name: 'country', description: 'Country code (ISO 3166-1 alpha-2)', required: false })
  async getPricingPreview(
    @Request() req: any,
    @Query('amount') amount: string,
    @Query('currency') currency?: string,
    @Query('country') country?: string,
  ): Promise<PricingPreviewDto> {
    const amountCents = parseInt(amount, 10);
    const countryCode = country || req.user?.country || 'US';
    const currencyCode = currency || 'usd';

    return this.pricingService.getPricingPreview(amountCents, countryCode, currencyCode);
  }
}
