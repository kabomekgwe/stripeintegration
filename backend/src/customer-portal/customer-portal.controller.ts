import { Controller, Post, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomerPortalService } from './customer-portal.service';

@Controller('customer-portal')
@UseGuards(JwtAuthGuard)
export class CustomerPortalController {
  constructor(private readonly portalService: CustomerPortalService) {}

  @Post('session')
  async createPortalSession(@Request() req) {
    const session = await this.portalService.createPortalSession(
      req.user.id,
      req.user.stripeCustomerId,
    );
    return { url: session.url };
  }

  @Get('configuration')
  async getConfiguration(@Request() req) {
    const config = await this.portalService.getOrCreateConfiguration();
    return { configurationId: config.id };
  }
}
