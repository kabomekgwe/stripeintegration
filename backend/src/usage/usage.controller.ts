import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsageService } from './usage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateUsageDto } from './dto/create-usage.dto';

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async recordUsage(@Request() req, @Body() createUsageDto: CreateUsageDto) {
    const usage = await this.usageService.recordUsage({
      userId: req.user.id,
      amount: createUsageDto.amount,
      usageCount: createUsageDto.usageCount,
      description: createUsageDto.description,
    });

    return { usage };
  }

  @Get()
  async findAll(@Request() req) {
    const usage = await this.usageService.findByUser(req.user.id);
    return { usage };
  }

  @Get('preview')
  async previewNextBill(@Request() req) {
    const preview = await this.usageService.previewNextBill(req.user.id);
    return { preview };
  }

  @Post('billing/generate')
  @HttpCode(HttpStatus.OK)
  async generateBilling(@Request() req) {
    const result = await this.usageService.generateMonthlyBilling({
      userId: req.user.id,
      stripeCustomerId: req.user.stripeCustomerId,
    });

    return result;
  }
}

// Admin controller for running all billing
@Controller('admin/billing')
@UseGuards(JwtAuthGuard)
export class AdminBillingController {
  constructor(private readonly usageService: UsageService) {}

  @Post('run-monthly')
  @HttpCode(HttpStatus.OK)
  async runMonthlyBilling() {
    const result = await this.usageService.generateAllMonthlyBilling();
    return result;
  }
}
