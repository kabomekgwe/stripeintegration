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
  UseInterceptors,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentRateLimitGuard } from './guards/rate-limit.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';

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
}
