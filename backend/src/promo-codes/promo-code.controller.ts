import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PromoCodeService } from './promo-code.service';
import type { CreatePromoCodeDto } from './dto/create-promo-code.dto';

@Controller('promo-codes')
export class PromoCodeController {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  // Public endpoint to validate a code
  @Get('validate/:code')
  async validateCode(@Param('code') code: string) {
    return this.promoCodeService.validatePromoCode(code);
  }

  // Admin endpoints
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createPromoCode(@Body() dto: CreatePromoCodeDto) {
    return this.promoCodeService.createPromoCode(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getPromoCodes(
    @Query('active') active?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.promoCodeService.getPromoCodes({
      active: active !== undefined ? active === 'true' : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getPromoCode(@Param('id') id: string) {
    return this.promoCodeService.getPromoCode(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deactivatePromoCode(@Param('id') id: string) {
    await this.promoCodeService.deactivatePromoCode(id);
    return { message: 'Promo code deactivated' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deletePromoCode(@Param('id') id: string) {
    await this.promoCodeService.deletePromoCode(id);
    return { message: 'Promo code deleted' };
  }
}
