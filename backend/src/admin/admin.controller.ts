import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly webhooksService: WebhooksService,
  ) {}

  @Get('dashboard')
  async getDashboard() {
    const metrics = await this.adminService.getDashboardMetrics();
    const recentTransactions = await this.adminService.getRecentTransactions(10);
    const paymentMethods = await this.adminService.getPaymentMethodDistribution();

    return {
      metrics,
      recentTransactions,
      paymentMethods,
    };
  }

  @Get('metrics')
  async getMetrics() {
    return this.adminService.getDashboardMetrics();
  }

  @Get('revenue')
  async getRevenue(
    @Query('period') period: 'day' | 'week' | 'month' = 'day',
    @Query('days') days: string = '30',
  ) {
    return this.adminService.getRevenueByPeriod(period, parseInt(days));
  }

  @Get('transactions')
  async getTransactions(
    @Query('limit') limit: string = '20',
  ) {
    return this.adminService.getRecentTransactions(parseInt(limit));
  }

  @Get('payment-methods')
  async getPaymentMethods() {
    return this.adminService.getPaymentMethodDistribution();
  }

  @Get('users')
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsersList(
      parseInt(page),
      parseInt(limit),
      search,
    );
  }

  @Get('users/:id')
  async getUserDetails(@Param('id') userId: string) {
    return this.adminService.getUserDetails(userId);
  }

  @Post('users/:id/suspend')
  async suspendUser(@Param('id') userId: string) {
    return this.adminService.suspendUser(userId);
  }

  // ===== WEBHOOK DASHBOARD =====

  @Get('webhooks/stats')
  async getWebhookStats() {
    return this.webhooksService.getWebhookStats();
  }

  @Get('webhooks/events')
  async getWebhookEvents(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
    @Query('processed') processed?: string,
    @Query('failed') failed?: string,
    @Query('type') type?: string,
  ) {
    return this.webhooksService.getWebhookEvents({
      limit: parseInt(limit),
      offset: parseInt(offset),
      processed: processed !== undefined ? processed === 'true' : undefined,
      failed: failed === 'true',
      type,
    });
  }

  @Get('webhooks/events/:id')
  async getWebhookEvent(@Param('id') id: string) {
    const event = await this.webhooksService.getWebhookEvent(id);
    if (!event) {
      return { error: 'Webhook event not found' };
    }
    return { event };
  }

  @Post('webhooks/events/:id/retry')
  async retryWebhookEvent(@Param('id') id: string) {
    await this.webhooksService.retryWebhookEvent(id);
    return { message: 'Webhook event retried successfully' };
  }

  @Get('webhooks/errors')
  async getRecentErrors(
    @Query('limit') limit: string = '20',
  ) {
    const errors = await this.webhooksService.getRecentErrors(parseInt(limit));
    return { errors };
  }
}
