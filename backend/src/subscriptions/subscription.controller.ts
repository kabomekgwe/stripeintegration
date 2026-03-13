import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto, CancelSubscriptionDto } from './dto/create-subscription.dto';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ===== PLANS =====

  @Get('plans')
  async getPlans() {
    const plans = await this.subscriptionService.getActivePlans();
    return { plans };
  }

  @Get('plans/:id')
  async getPlan(@Param('id') id: string) {
    const plan = await this.subscriptionService.getPlanById(id);
    if (!plan) {
      return { plan: null };
    }
    return { plan };
  }

  // ===== SUBSCRIPTIONS =====

  @Post()
  async createSubscription(
    @Request() req,
    @Body() dto: CreateSubscriptionDto,
  ) {
    const result = await this.subscriptionService.createSubscription(
      req.user.id,
      req.user.stripeCustomerId,
      dto,
    );
    return result;
  }

  @Get()
  async getSubscriptions(@Request() req) {
    const subscription = await this.subscriptionService.getUserSubscription(req.user.id);
    const subscriptions = await this.subscriptionService.getUserSubscriptions(req.user.id);
    return {
      current: subscription,
      all: subscriptions,
    };
  }

  @Patch(':id')
  async updateSubscription(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionService.updateSubscription(id, req.user.id, dto);
  }

  @Delete(':id')
  async cancelSubscription(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptionService.cancelSubscription(id, req.user.id, dto);
  }
}
