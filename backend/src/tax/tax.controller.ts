import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TaxService } from './tax.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class TaxCalculationDto {
  amount: number;
  currency: string;
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
}

class CartTaxPreviewDto {
  items: Array<{ amount: number; description?: string }>;
  customerDetails?: TaxCalculationDto['customerDetails'];
}

class TaxIdVerificationDto {
  taxId: string;
  taxType?: 'eu_vat' | 'gb_vat' | 'au_abn' | string;
}

@ApiTags('tax')
@ApiBearerAuth()
@Controller('tax')
@UseGuards(JwtAuthGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Post('calculate')
  async calculateTax(@Body() dto: TaxCalculationDto) {
    const result = await this.taxService.calculateTax({
      amount: dto.amount,
      currency: dto.currency,
      customerDetails: dto.customerDetails,
    });

    return {
      ...result,
      // Convert cents to dollars for display
      taxAmountDollars: (result.taxAmount / 100).toFixed(2),
      totalAmountDollars: (result.totalAmount / 100).toFixed(2),
    };
  }

  @Post('preview')
  async previewCartTax(@Body() dto: CartTaxPreviewDto) {
    return this.taxService.previewCartTax(dto.items, dto.customerDetails);
  }

  @Post('verify-id')
  async verifyTaxId(@Body() dto: TaxIdVerificationDto) {
    return this.taxService.verifyTaxId(dto.taxId, dto.taxType);
  }

  @Get('settings')
  async getTaxSettings() {
    return this.taxService.getTaxSettings();
  }
}
