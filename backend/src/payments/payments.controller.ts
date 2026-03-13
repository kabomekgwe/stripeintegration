import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentRateLimitGuard } from './guards/rate-limit.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(PaymentRateLimitGuard)
  async createPaymentIntent(
    @Request() req,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    const result = await this.paymentsService.createPaymentIntent({
      userId: req.user.id,
      stripeCustomerId: req.user.stripeCustomerId,
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      paymentMethodId: createPaymentDto.paymentMethodId,
      description: createPaymentDto.description,
      customerDetails: createPaymentDto.customerDetails && {
        address: {
          line1: createPaymentDto.customerDetails.address.line1,
          city: createPaymentDto.customerDetails.address.city,
          state: createPaymentDto.customerDetails.address.state,
          postal_code: createPaymentDto.customerDetails.address.postal_code,
          country: createPaymentDto.customerDetails.address.country,
        },
      },
    });

    return result;
  }

  @Post(':id/confirm')
  async confirmPayment(@Request() req, @Param('id') id: string) {
    const payment = await this.paymentsService.confirmPayment(id, req.user.id);
    return { payment };
  }

  @Get()
  async findAll(@Request() req) {
    const payments = await this.paymentsService.findByUser(req.user.id);
    return { payments };
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    const payment = await this.paymentsService.findById(id, req.user.id);
    if (!payment) {
      return { payment: null };
    }
    return { payment };
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retryPayment(@Request() req, @Param('id') id: string) {
    const payment = await this.paymentsService.retryPayment(id, req.user.id);
    return { payment };
  }

  // ==================== REFUNDS ====================

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  async createRefund(
    @Request() req,
    @Param('id') id: string,
    @Body() refundDto: CreateRefundDto,
  ) {
    const refund = await this.paymentsService.createRefund(
      id,
      req.user.id,
      refundDto,
    );
    return { refund };
  }

  @Get(':id/refunds')
  async getRefunds(@Request() req, @Param('id') id: string) {
    const refunds = await this.paymentsService.getRefundsForPayment(id, req.user.id);
    return { refunds };
  }

  @Get('refunds/all')
  async getAllRefunds(@Request() req) {
    const refunds = await this.paymentsService.getUserRefunds(req.user.id);
    return { refunds };
  }
}
