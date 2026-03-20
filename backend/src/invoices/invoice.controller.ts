import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  Request,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('payment/:paymentId')
  @Header('Content-Type', 'application/pdf')
  async downloadPaymentInvoice(
    @Request() req,
    @Param('paymentId') paymentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdfBuffer = await this.invoiceService.generateInvoicePDF(
      paymentId,
      req.user.id,
    );

    res.set({
      'Content-Disposition': `attachment; filename="invoice-${paymentId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return new StreamableFile(pdfBuffer);
  }

  @Get('usage/:usageId')
  @Header('Content-Type', 'application/pdf')
  async downloadUsageInvoice(
    @Request() req,
    @Param('usageId') usageId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdfBuffer = await this.invoiceService.generateUsageInvoicePDF(
      usageId,
      req.user.id,
    );

    res.set({
      'Content-Disposition': `attachment; filename="invoice-usage-${usageId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return new StreamableFile(pdfBuffer);
  }

  @Get('payment/:paymentId/view')
  @Header('Content-Type', 'application/pdf')
  async viewPaymentInvoice(
    @Request() req,
    @Param('paymentId') paymentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdfBuffer = await this.invoiceService.generateInvoicePDF(
      paymentId,
      req.user.id,
    );

    res.set({
      'Content-Disposition': `inline; filename="invoice-${paymentId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return new StreamableFile(pdfBuffer);
  }
}
