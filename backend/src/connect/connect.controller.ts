import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ConnectService } from './connect.service';
import type { CreateConnectedAccountDto } from './dto/create-connected-account.dto';
import type { CreateTransferDto } from './dto/create-transfer.dto';

@ApiTags('connect')
@ApiBearerAuth()
@Controller('connect')
@UseGuards(JwtAuthGuard)
export class ConnectController {
  constructor(private readonly connectService: ConnectService) {}

  @Post('accounts')
  async createConnectedAccount(
    @Request() req,
    @Body() dto: CreateConnectedAccountDto,
  ) {
    return this.connectService.createConnectedAccount(req.user.id, dto);
  }

  @Get('account')
  async getConnectedAccount(@Request() req) {
    return this.connectService.getConnectedAccount(req.user.id);
  }

  @Post('onboarding-link')
  async createOnboardingLink(@Request() req) {
    return this.connectService.createOnboardingLink(req.user.id);
  }

  @Post('login-link')
  async createLoginLink(@Request() req) {
    return this.connectService.createLoginLink(req.user.id);
  }

  @Post('direct-charge')
  async createDirectCharge(
    @Body() dto: {
      amount: number;
      currency: string;
      connectedAccountId: string;
      paymentMethodId: string;
      description?: string;
      applicationFeeAmount?: number;
    },
  ) {
    return this.connectService.createDirectCharge(dto);
  }

  @Post('transfers')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async createTransfer(@Body() dto: CreateTransferDto) {
    return this.connectService.createTransfer(dto);
  }

  @Get('transfers/:connectedAccountId')
  async getTransfers(@Param('connectedAccountId') connectedAccountId: string) {
    return this.connectService.getTransfers(connectedAccountId);
  }

  @Get('platform-balance')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getPlatformBalance() {
    return this.connectService.getPlatformBalance();
  }
}
