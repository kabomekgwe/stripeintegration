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

@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  async findAll(@Request() req) {
    const methods = await this.paymentMethodsService.findByUser(req.user.id);
    return { paymentMethods: methods };
  }

  @Post('setup-intent')
  async createSetupIntent(@Request() req) {
    const result = await this.paymentMethodsService.createSetupIntent(
      req.user.id,
      req.user.stripeCustomerId,
    );
    return result;
  }

  @Post('save')
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
  async setDefault(@Request() req, @Param('id') id: string) {
    const method = await this.paymentMethodsService.setDefault(req.user.id, id);
    return { paymentMethod: method };
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    const method = await this.paymentMethodsService.remove(req.user.id, id);
    return { paymentMethod: method };
  }
}
