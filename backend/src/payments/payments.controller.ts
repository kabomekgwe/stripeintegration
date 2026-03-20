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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentRateLimitGuard } from './guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { IdempotencyGuard } from '../idempotency/idempotency.guard';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(PaymentRateLimitGuard, IdempotencyGuard)
  @ApiOperation({ summary: 'Create a payment intent for direct payment' })
  @ApiResponse({ status: 201, description: 'Payment intent created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 402, description: 'Payment failed - card declined or insufficient funds' })
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
  @ApiOperation({ summary: 'Create a Stripe checkout session for payment' })
  @ApiResponse({ status: 201, description: 'Checkout session created, returns session URL' })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Confirm a payment intent' })
  @ApiResponse({ status: 200, description: 'Payment confirmed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async confirmPayment(@Request() req, @Param('id') id: string) {
    const payment = await this.paymentsService.confirmPayment(id, req.user.id);
    return { payment };
  }

  @Get()
  @ApiOperation({ summary: 'Get all payments for current user' })
  @ApiResponse({ status: 200, description: 'List of payments' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req) {
    const payments = await this.paymentsService.findByUser(req.user.id);
    return { payments };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findOne(@Request() req, @Param('id') id: string) {
    const payment = await this.paymentsService.findById(id, req.user.id);
    if (!payment) {
      return { payment: null };
    }
    return { payment };
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed payment' })
  @ApiResponse({ status: 200, description: 'Payment retry initiated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async retryPayment(@Request() req, @Param('id') id: string) {
    const payment = await this.paymentsService.retryPayment(id, req.user.id);
    return { payment };
  }

  // ==================== REFUNDS ====================

  @Post(':id/refund')
  @UseGuards(IdempotencyGuard)
  @RateLimit(10, 60000)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a refund for a payment' })
  @ApiResponse({ status: 200, description: 'Refund created successfully' })
  @ApiResponse({ status: 400, description: 'Cannot refund this payment' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Get all refunds for a specific payment' })
  @ApiResponse({ status: 200, description: 'List of refunds for the payment' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRefunds(@Request() req, @Param('id') id: string) {
    const refunds = await this.paymentsService.getRefundsForPayment(id, req.user.id);
    return { refunds };
  }

  @Get('refunds/all')
  @ApiOperation({ summary: 'Get all refunds for current user' })
  @ApiResponse({ status: 200, description: 'List of all user refunds' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllRefunds(@Request() req) {
    const refunds = await this.paymentsService.getUserRefunds(req.user.id);
    return { refunds };
  }
}
