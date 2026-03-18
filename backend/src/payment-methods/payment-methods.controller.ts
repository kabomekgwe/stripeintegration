import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StripeService } from '../stripe/stripe.service';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly stripeService: StripeService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req) {
    const methods = await this.paymentMethodsService.findByUser(req.user.id);
    return { paymentMethods: methods };
  }

  @Get('enabled')
  @UseGuards(JwtAuthGuard)
  async getEnabledPaymentMethods(@Request() req) {
    const result = await this.paymentMethodsService.getEnabledPaymentMethods(
      req.user.id,
    );
    return result;
  }

  @Post('setup-intent')
  @UseGuards(JwtAuthGuard)
  async createSetupIntent(
    @Request() req,
    @Body('paymentMethodId') paymentMethodId?: string,
  ) {
    const result = await this.paymentMethodsService.createSetupIntent(
      req.user.id,
      req.user.stripeCustomerId,
      paymentMethodId,
    );
    return result;
  }

  @Post('save')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async savePaymentMethod(
    @Request() req,
    @Body('paymentMethodId') paymentMethodId: string,
  ) {
    const method = await this.paymentMethodsService.savePaymentMethod(
      req.user.id,
      paymentMethodId,
      req.user.stripeCustomerId,
    );
    return { paymentMethod: method };
  }

  @Post(':id/default')
  @UseGuards(JwtAuthGuard)
  async setDefault(@Request() req, @Param('id') id: string) {
    const method = await this.paymentMethodsService.setDefault(req.user.id, id);
    return { paymentMethod: method };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Request() req, @Param('id') id: string) {
    const method = await this.paymentMethodsService.remove(req.user.id, id);
    return { paymentMethod: method };
  }
}
