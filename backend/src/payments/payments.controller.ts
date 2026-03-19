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
  Headers,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentRateLimitGuard } from './guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { IdempotencyGuard } from '../idempotency/idempotency.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(PaymentRateLimitGuard, IdempotencyGuard)
  async createPaymentIntent(
    @Request() req,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    // Idempotency-Key is validated and required by IdempotencyGuard
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    const result = await this.paymentsService.createPaymentIntent({
      userId: req.user.id,
      stripeCustomerId: req.user.stripeCustomerId,
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      paymentMethodId: createPaymentDto.paymentMethodId,
      description: createPaymentDto.description,
      countryCode: req.user.country,
      customerDetails: createPaymentDto.customerDetails && {
        address: {
          line1: createPaymentDto.customerDetails.address.line1,
          city: createPaymentDto.customerDetails.address.city,
          state: createPaymentDto.customerDetails.address.state,
          postal_code: createPaymentDto.customerDetails.address.postal_code,
          country: createPaymentDto.customerDetails.address.country,
        },
      },
      idempotencyKey, // Frontend-generated key
    });

    return result;
  }

  @Post('checkout-session')
  @UseGuards(PaymentRateLimitGuard, IdempotencyGuard)
  async createCheckoutSession(
    @Request() req,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    const frontendUrl = req.headers.origin || 'http://localhost:3000';
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    return this.paymentsService.createCheckoutSession({
      userId: req.user.id,
      stripeCustomerId: req.user.stripeCustomerId,
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      description: createPaymentDto.description,
      returnUrl: `${frontendUrl}/payments?session_id={CHECKOUT_SESSION_ID}`,
      idempotencyKey, // Frontend-generated key
    });
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
  @UseGuards(IdempotencyGuard)
  @RateLimit(10, 60000)
  @HttpCode(HttpStatus.OK)
  async createRefund(
    @Request() req,
    @Param('id') id: string,
    @Body() refundDto: CreateRefundDto,
  ) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    const refund = await this.paymentsService.createRefund(
      id,
      req.user.id,
      {
        ...refundDto,
        idempotencyKey, // Frontend-generated key
      },
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
