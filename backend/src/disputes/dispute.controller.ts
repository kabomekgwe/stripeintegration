import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DisputeService } from './dispute.service';
import type { DisputeEvidence } from './dto/dispute-evidence.dto';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getDisputes(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.disputeService.getDisputes({
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('my-disputes')
  async getMyDisputes(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.disputeService.getDisputes({
      userId: req.user.id,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getDisputeStats() {
    return this.disputeService.getDisputeStats();
  }

  @Get(':id')
  async getDispute(@Param('id') id: string) {
    return this.disputeService.getDispute(id);
  }

  @Post(':id/evidence')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async submitEvidence(
    @Param('id') id: string,
    @Body() evidence: DisputeEvidence,
  ) {
    await this.disputeService.submitEvidence(id, evidence);
    return { message: 'Evidence submitted successfully' };
  }

  @Post(':id/close')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async closeDispute(
    @Param('id') id: string,
    @Body('outcome') outcome: 'won' | 'lost',
  ) {
    await this.disputeService.closeDispute(id, outcome);
    return { message: `Dispute closed as ${outcome}` };
  }
}
