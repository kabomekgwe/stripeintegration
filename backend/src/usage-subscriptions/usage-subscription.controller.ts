import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsageSubscriptionService } from './usage-subscription.service';

@ApiTags('usage-subscriptions')
@ApiBearerAuth()
@Controller('usage-subscriptions')
@UseGuards(JwtAuthGuard)
export class UsageSubscriptionController {
  constructor(private readonly usageSubscriptionService: UsageSubscriptionService) {}

  @Post()
  async createUsageSubscription(
    @Request() req,
    @Body() dto: { priceId: string; paymentMethodId?: string },
  ) {
    return this.usageSubscriptionService.createUsageSubscription(
      req.user.id,
      req.user.stripeCustomerId,
      dto,
    );
  }

  @Post(':id/usage')
  async recordUsage(
    @Param('id') subscriptionId: string,
    @Body() dto: { quantity: number; timestamp?: Date },
  ) {
    return this.usageSubscriptionService.recordUsage({
      subscriptionId,
      quantity: dto.quantity,
      timestamp: dto.timestamp,
    });
  }

  @Get(':id/usage-summary')
  async getUsageSummary(@Param('id') subscriptionId: string) {
    return this.usageSubscriptionService.getUsageSummary(subscriptionId);
  }
}
