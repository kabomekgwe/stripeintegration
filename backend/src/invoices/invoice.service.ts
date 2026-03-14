import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as puppeteer from 'puppeteer';

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  currency: string;
  paymentStatus: string;
  paymentDate?: string;
  paymentMethod?: string;
}

@Injectable()
export class InvoiceService {
  private browser: puppeteer.Browser | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.initBrowser();
  }

  private async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  async generateInvoicePDF(
    paymentId: string,
    userId: string,
  ): Promise<Buffer> {
    // Get payment with related data
    const payment = await this.prisma.paymentRecord.findFirst({
      where: { id: paymentId, userId },
      include: {
        user: true,
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const invoiceData = this.buildInvoiceData(payment);
    const html = this.getInvoiceTemplate(invoiceData);

    return this.generatePDFFromHTML(html);
  }

  async generateUsageInvoicePDF(
    usageId: string,
    userId: string,
  ): Promise<Buffer> {
    const usage = await this.prisma.usageRecord.findFirst({
      where: { id: usageId, userId },
      include: {
        user: true,
        payment: true,
      },
    });

    if (!usage) {
      throw new NotFoundException('Usage record not found');
    }

    const invoiceData = this.buildUsageInvoiceData(usage);
    const html = this.getInvoiceTemplate(invoiceData);

    return this.generatePDFFromHTML(html);
  }

  private async generatePDFFromHTML(html: string): Promise<Buffer> {
    await this.initBrowser();
    const page = await this.browser!.newPage();

    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
      });

      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  private buildInvoiceData(payment: any): InvoiceData {
    const companyName = this.configService.get('COMPANY_NAME') || 'Payment System Inc.';
    const companyAddress = this.configService.get('COMPANY_ADDRESS') || '123 Business St, City, Country';
    const companyEmail = this.configService.get('COMPANY_EMAIL') || 'billing@example.com';

    const issueDate = new Date(payment.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const dueDate = new Date(payment.createdAt);
    dueDate.setDate(dueDate.getDate() + 30);

    const totalRefunded = payment.refunds
      ?.filter((r: any) => r.status === 'SUCCEEDED')
      .reduce((sum: number, r: any) => sum + r.amount, 0) || 0;

    const netAmount = (payment.amount + (payment.taxAmount || 0)) - totalRefunded;
    const taxAmount = payment.taxAmount || 0;
    const taxRate = payment.taxRate || 0;

    const items = [
      {
        description: payment.description || 'Payment',
        quantity: 1,
        unitPrice: payment.amount / 100,
        amount: payment.amount / 100,
      },
    ];

    if (taxAmount > 0) {
      items.push({
        description: payment.taxDisplayName || 'Tax',
        quantity: 1,
        unitPrice: taxAmount / 100,
        amount: taxAmount / 100,
      });
    }

    return {
      invoiceNumber: `INV-${payment.id.slice(-8).toUpperCase()}`,
      issueDate,
      dueDate: dueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      companyName,
      companyAddress,
      companyEmail,
      customerName: payment.user.name || payment.user.email,
      customerEmail: payment.user.email,
      items,
      subtotal: payment.amount / 100,
      taxAmount: taxAmount / 100,
      taxRate,
      total: netAmount / 100,
      currency: payment.currency.toUpperCase(),
      paymentStatus: payment.status,
      paymentDate: payment.status === 'SUCCEEDED' ? issueDate : undefined,
      paymentMethod: payment.paymentMethodId ? 'Card' : 'Unknown',
    };
  }

  private buildUsageInvoiceData(usage: any): InvoiceData {
    const companyName = this.configService.get('COMPANY_NAME') || 'Payment System Inc.';
    const companyAddress = this.configService.get('COMPANY_ADDRESS') || '123 Business St, City, Country';
    const companyEmail = this.configService.get('COMPANY_EMAIL') || 'billing@example.com';

    const issueDate = usage.payment?.createdAt
      ? new Date(usage.payment.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

    return {
      invoiceNumber: `INV-USG-${usage.id.slice(-8).toUpperCase()}`,
      issueDate,
      dueDate: issueDate,
      companyName,
      companyAddress,
      companyEmail,
      customerName: usage.user.name || usage.user.email,
      customerEmail: usage.user.email,
      items: [
        {
          description: usage.description || `Usage for ${usage.period}`,
          quantity: usage.usageCount,
          unitPrice: (usage.amount / usage.usageCount) / 100,
          amount: usage.amount / 100,
        },
      ],
      subtotal: usage.amount / 100,
      taxAmount: 0,
      taxRate: 0,
      total: usage.amount / 100,
      currency: 'USD',
      paymentStatus: usage.billed ? 'PAID' : 'PENDING',
      paymentDate: usage.billed ? issueDate : undefined,
    };
  }

  private getInvoiceTemplate(data: InvoiceData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    .invoice {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #0066cc;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #0066cc;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h1 {
      font-size: 24px;
      color: #333;
      margin-bottom: 5px;
    }
    .invoice-number {
      font-size: 14px;
      color: #666;
    }
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .address-block h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
    }
    .address-block p {
      font-size: 14px;
      line-height: 1.6;
      color: #333;
    }
    .details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .detail-item {
      text-align: center;
    }
    .detail-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 5px;
      letter-spacing: 0.5px;
    }
    .detail-value {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-paid {
      background: #d4edda;
      color: #155724;
    }
    .status-pending {
      background: #fff3cd;
      color: #856404;
    }
    .status-failed {
      background: #f8d7da;
      color: #721c24;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background: #0066cc;
      color: white;
      padding: 12px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 14px;
    }
    td:nth-child(3),
    td:nth-child(4),
    td:nth-child(5) {
      text-align: right;
    }
    .totals {
      margin-left: auto;
      width: 300px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
      font-size: 14px;
    }
    .total-row:last-child {
      border-bottom: 2px solid #333;
      font-weight: bold;
      font-size: 16px;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .footer p {
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="logo">${data.companyName}</div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="invoice-number">${data.invoiceNumber}</div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>From</h3>
        <p><strong>${data.companyName}</strong><br>
        ${data.companyAddress.replace(/\n/g, '<br>')}<br>
        ${data.companyEmail}</p>
      </div>
      <div class="address-block">
        <h3>Bill To</h3>
        <p><strong>${data.customerName}</strong><br>
        ${data.customerEmail}</p>
      </div>
    </div>

    <div class="details">
      <div class="detail-item">
        <div class="detail-label">Invoice Date</div>
        <div class="detail-value">${data.issueDate}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Due Date</div>
        <div class="detail-value">${data.dueDate}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Status</div>
        <div class="detail-value">
          <span class="status status-${data.paymentStatus.toLowerCase()}">
            ${data.paymentStatus}
          </span>
        </div>
      </div>
      ${data.paymentDate ? `
      <div class="detail-item">
        <div class="detail-label">Payment Date</div>
        <div class="detail-value">${data.paymentDate}</div>
      </div>
      ` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
          <tr>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
            <td>${data.currency} ${item.unitPrice.toFixed(2)}</td>
            <td>${data.currency} ${item.amount.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${data.currency} ${data.subtotal.toFixed(2)}</span>
      </div>
      ${data.taxAmount > 0 ? `
      <div class="total-row">
        <span>Tax (${data.taxRate}%)</span>
        <span>${data.currency} ${data.taxAmount.toFixed(2)}</span>
      </div>
      ` : ''}
      <div class="total-row">
        <span>Total</span>
        <span>${data.currency} ${data.total.toFixed(2)}</span>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>Questions? Contact us at ${data.companyEmail}</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
