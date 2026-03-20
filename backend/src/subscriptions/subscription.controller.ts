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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto, UpdateSubscriptionDto, CancelSubscriptionDto } from './dto/create-subscription.dto';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ===== PLANS =====

  @Get('plans')
  @ApiOperation({ summary: 'Get all available subscription plans' })
  @ApiResponse({ status: 200, description: 'List of available subscription plans' })
  async getPlans() {
    const plans = await this.subscriptionService.getActivePlans();
    return { plans };
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get a specific subscription plan by ID' })
  @ApiResponse({ status: 200, description: 'Plan details' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getPlan(@Param('id') id: string) {
    const plan = await this.subscriptionService.getPlanById(id);
    if (!plan) {
      return { plan: null };
    }
    return { plan };
  }

  // ===== SUBSCRIPTIONS =====

  @Post()
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid subscription data or user already has active subscription' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 402, description: 'Payment failed' })
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
  @ApiOperation({ summary: 'Get current and all subscriptions for user' })
  @ApiResponse({ status: 200, description: 'User subscriptions with current active subscription' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSubscriptions(@Request() req) {
    const subscription = await this.subscriptionService.getUserSubscription(req.user.id);
    const subscriptions = await this.subscriptionService.getUserSubscriptions(req.user.id);
    return {
      current: subscription,
      all: subscriptions,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a subscription (e.g., change plan)' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async updateSubscription(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionService.updateSubscription(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel subscription' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async cancelSubscription(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptionService.cancelSubscription(id, req.user.id, dto);
  }
}
