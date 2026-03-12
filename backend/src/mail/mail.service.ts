import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    
    this.fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@example.com';
    this.fromName = this.configService.get<string>('FROM_NAME') || 'Payment System';

    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn('SMTP not configured - emails will be logged only');
      this.transporter = null as any;
    } else {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    }
  }

  private async send(data: EmailData): Promise<void> {
    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    };

    // Log email in development
    this.logger.log(`📧 Email to ${data.to}: ${data.subject}`);
    
    if (!this.transporter) {
      this.logger.debug('SMTP not configured - email logged only');
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Email sent to ${data.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  // ==================== PASSWORD RESET ====================

  async sendPasswordReset(email: string, resetToken: string, userName: string): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    
    const html = this.getPasswordResetTemplate({
      userName,
      resetUrl,
      expiresIn: '1 hour',
    });

    await this.send({
      to: email,
      subject: 'Reset Your Password',
      html,
      text: `Hi ${userName},\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    });
  }

  // ==================== PAYMENT EMAILS ====================

  async sendPaymentReceipt(
    email: string,
    payment: {
      amount: number;
      currency: string;
      description?: string | null;
      createdAt: Date;
      stripePaymentIntentId: string;
    },
    userName: string,
  ): Promise<void> {
    const html = this.getPaymentReceiptTemplate({
      userName,
      amount: (payment.amount / 100).toFixed(2),
      currency: payment.currency.toUpperCase(),
      description: payment.description || 'Payment',
      date: payment.createdAt.toLocaleDateString(),
      transactionId: payment.stripePaymentIntentId,
    });

    await this.send({
      to: email,
      subject: `Payment Receipt - $${(payment.amount / 100).toFixed(2)}`,
      html,
      text: `Payment of $${(payment.amount / 100).toFixed(2)} received. Transaction ID: ${payment.stripePaymentIntentId}`,
    });
  }

  async sendPaymentFailed(
    email: string,
    payment: {
      amount: number;
      currency: string;
      errorMessage?: string | null;
    },
    userName: string,
    retryUrl: string,
  ): Promise<void> {
    const html = this.getPaymentFailedTemplate({
      userName,
      amount: (payment.amount / 100).toFixed(2),
      currency: payment.currency.toUpperCase(),
      errorMessage: payment.errorMessage || 'Card was declined',
      retryUrl,
    });

    await this.send({
      to: email,
      subject: 'Payment Failed - Action Required',
      html,
      text: `Payment of $${(payment.amount / 100).toFixed(2)} failed. ${payment.errorMessage}`,
    });
  }

  // ==================== BILLING EMAILS ====================

  async sendBillingSummary(
    email: string,
    billing: {
      period: string;
      totalAmount: number;
      usageCount: number;
    },
    userName: string,
  ): Promise<void> {
    const html = this.getBillingSummaryTemplate({
      userName,
      period: billing.period,
      amount: (billing.totalAmount / 100).toFixed(2),
      usageCount: billing.usageCount,
    });

    await this.send({
      to: email,
      subject: `Monthly Billing Summary - ${billing.period}`,
      html,
      text: `Your usage for ${billing.period}: ${billing.usageCount} units, $${(billing.totalAmount / 100).toFixed(2)}`,
    });
  }

  async sendBillingFailed(
    email: string,
    billing: {
      period: string;
      totalAmount: number;
    },
    userName: string,
    paymentMethodsUrl: string,
  ): Promise<void> {
    const html = this.getBillingFailedTemplate({
      userName,
      period: billing.period,
      amount: (billing.totalAmount / 100).toFixed(2),
      paymentMethodsUrl,
    });

    await this.send({
      to: email,
      subject: 'Automatic Billing Failed - Update Payment Method',
      html,
      text: `Billing for ${billing.period} failed. Please update your payment method.`,
    });
  }

  // ==================== WELCOME EMAIL ====================

  async sendWelcome(email: string, userName: string, dashboardUrl: string): Promise<void> {
    const html = this.getWelcomeTemplate({ userName, dashboardUrl });

    await this.send({
      to: email,
      subject: 'Welcome to Payment System',
      html,
      text: `Welcome ${userName}! Your account is ready.`,
    });
  }

  // ==================== REFUND EMAILS ====================

  async sendRefundConfirmation(
    email: string,
    refund: {
      amount: number;
      currency: string;
      originalAmount: number;
      paymentDescription?: string | null;
      refundId: string;
    },
    userName: string,
  ): Promise<void> {
    const html = this.getRefundConfirmationTemplate({
      userName,
      amount: (refund.amount / 100).toFixed(2),
      originalAmount: (refund.originalAmount / 100).toFixed(2),
      currency: refund.currency.toUpperCase(),
      paymentDescription: refund.paymentDescription || 'Payment',
      refundId: refund.refundId,
    });

    await this.send({
      to: email,
      subject: `Refund Processed - $${(refund.amount / 100).toFixed(2)}`,
      html,
      text: `Refund of $${(refund.amount / 100).toFixed(2)} has been processed. Refund ID: ${refund.refundId}`,
    });
  }

  private getRefundConfirmationTemplate(data: { userName: string; amount: string; originalAmount: string; currency: string; paymentDescription: string; refundId: string }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #28a745;">✓ Refund Processed</h2>
        <p>Hi ${data.userName},</p>
        <p>Your refund has been processed successfully.</p>
        <table style="width: 100%; background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <tr><td><strong>Refund Amount:</strong></td><td>${data.currency} $${data.amount}</td></tr>
          <tr><td><strong>Original Payment:</strong></td><td>${data.currency} $${data.originalAmount}</td></tr>
          <tr><td><strong>Description:</strong></td><td>${data.paymentDescription}</td></tr>
          <tr><td><strong>Refund ID:</strong></td><td style="font-family: monospace; font-size: 12px;">${data.refundId}</td></tr>
        </table>
        <p style="color: #666; font-size: 14px;">Refunds typically take 5-10 business days to appear on your statement.</p>
      </div>
    `;
  }

  // ==================== TEMPLATES ====================

  private getPasswordResetTemplate(data: { userName: string; resetUrl: string; expiresIn: string }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hi ${data.userName},</p>
        <p>You requested to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetUrl}" 
             style="background: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">This link expires in ${data.expiresIn}.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;
  }

  private getPaymentReceiptTemplate(data: { userName: string; amount: string; currency: string; description: string; date: string; transactionId: string }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #28a745;">✓ Payment Successful</h2>
        <p>Hi ${data.userName},</p>
        <p>Thank you for your payment. Here are the details:</p>
        <table style="width: 100%; background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <tr><td><strong>Amount:</strong></td><td>${data.currency} $${data.amount}</td></tr>
          <tr><td><strong>Description:</strong></td><td>${data.description}</td></tr>
          <tr><td><strong>Date:</strong></td><td>${data.date}</td></tr>
          <tr><td><strong>Transaction ID:</strong></td><td style="font-family: monospace; font-size: 12px;">${data.transactionId}</td></tr>
        </table>
        <p style="color: #666; font-size: 14px;">Keep this receipt for your records.</p>
      </div>
    `;
  }

  private getPaymentFailedTemplate(data: { userName: string; amount: string; currency: string; errorMessage: string; retryUrl: string }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc3545;">⚠ Payment Failed</h2>
        <p>Hi ${data.userName},</p>
        <p>We couldn't process your payment of <strong>${data.currency} $${data.amount}</strong>.</p>
        <p><strong>Error:</strong> ${data.errorMessage}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.retryUrl}" 
             style="background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Try Again
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">You may need to update your payment method.</p>
      </div>
    `;
  }

  private getBillingSummaryTemplate(data: { userName: string; period: string; amount: string; usageCount: number }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Monthly Billing Summary</h2>
        <p>Hi ${data.userName},</p>
        <p>Here's your usage summary for <strong>${data.period}</strong>:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p style="font-size: 24px; margin: 0;"><strong>$${data.amount}</strong></p>
          <p style="color: #666; margin: 5px 0 0 0;">${data.usageCount} usage units</p>
        </div>
        <p>This amount has been charged to your default payment method.</p>
        <p style="color: #666; font-size: 14px;">View detailed usage in your <a href="#">dashboard</a>.</p>
      </div>
    `;
  }

  private getBillingFailedTemplate(data: { userName: string; period: string; amount: string; paymentMethodsUrl: string }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc3545;">⚠ Automatic Billing Failed</h2>
        <p>Hi ${data.userName},</p>
        <p>We couldn't automatically bill your account for <strong>${data.period}</strong> ($${data.amount}).</p>
        <p>Your service may be interrupted if this isn't resolved.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.paymentMethodsUrl}" 
             style="background: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Update Payment Method
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">Questions? Contact us at support@example.com</p>
      </div>
    `;
  }

  private getWelcomeTemplate(data: { userName: string; dashboardUrl: string }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #28a745;">Welcome to Payment System!</h2>
        <p>Hi ${data.userName},</p>
        <p>Your account is now ready. You can:</p>
        <ul>
          <li>Add payment methods</li>
          <li>Make instant payments</li>
          <li>Track your usage</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.dashboardUrl}" 
             style="background: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
      </div>
    `;
  }

  // ==================== INVOICE EMAILS ====================

  async sendInvoiceWithAttachment(
    email: string,
    invoice: {
      invoiceNumber: string;
      amount: number;
      currency: string;
      pdfBuffer: Buffer;
    },
    userName: string,
  ): Promise<void> {
    const html = this.getInvoiceEmailTemplate({
      userName,
      invoiceNumber: invoice.invoiceNumber,
      amount: (invoice.amount / 100).toFixed(2),
      currency: invoice.currency.toUpperCase(),
    });

    await this.sendWithAttachment({
      to: email,
      subject: `Invoice ${invoice.invoiceNumber} - $${(invoice.amount / 100).toFixed(2)}`,
      html,
      text: `Your invoice ${invoice.invoiceNumber} for $${(invoice.amount / 100).toFixed(2)} is attached.`,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: invoice.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  private async sendWithAttachment(data: EmailData & { attachments?: any[] }): Promise<void> {
    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
      attachments: data.attachments,
    };

    this.logger.log(`📧 Email with attachment to ${data.to}: ${data.subject}`);

    if (!this.transporter) {
      this.logger.debug('SMTP not configured - email logged only');
      return;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Email with attachment sent to ${data.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  private getInvoiceEmailTemplate(data: { userName: string; invoiceNumber: string; amount: string; currency: string }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0066cc;">Invoice Attached</h2>
        <p>Hi ${data.userName},</p>
        <p>Please find your invoice attached to this email.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
          <p style="margin: 10px 0 0 0; font-size: 18px;">
            <strong>Total: ${data.currency} $${data.amount}</strong>
          </p>
        </div>
        <p>You can also view and download this invoice anytime from your <a href="#">Dashboard</a>.</p>
        <p style="color: #666; font-size: 14px;">Thank you for your business!</p>
      </div>
    `;
  }
}
