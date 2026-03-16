import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import Stripe from 'stripe';
import { CreateConnectedAccountDto } from './dto/create-connected-account.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

export type { CreateConnectedAccountDto, CreateTransferDto };

@Injectable()
export class ConnectService {
  private readonly logger = new Logger(ConnectService.name);
  private readonly platformFeePercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {
    this.platformFeePercent = this.configService.get<number>('PLATFORM_FEE_PERCENT') || 2.5;
  }

  async createConnectedAccount(
    userId: string,
    dto: CreateConnectedAccountDto,
  ): Promise<{ account: Awaited<ReturnType<typeof this.prisma.connectedAccount.create>>; onboardingUrl?: string }> {
    // Check if user already has a connected account
    const existing = await this.prisma.connectedAccount.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new BadRequestException('User already has a connected account');
    }

    // Create account in Stripe
    const accountData: Stripe.AccountCreateParams = {
      type: 'express',
      country: dto.country,
      email: dto.email,
      business_type: dto.businessType || 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    };

    if (dto.businessType === 'individual' && dto.individual) {
      accountData.individual = {
        first_name: dto.individual.firstName,
        last_name: dto.individual.lastName,
        dob: {
          day: dto.individual.dob.day,
          month: dto.individual.dob.month,
          year: dto.individual.dob.year,
        },
        address: {
          line1: dto.individual.address.line1,
          city: dto.individual.address.city,
          postal_code: dto.individual.address.postalCode,
          country: dto.individual.address.country,
        },
      };
    } else if (dto.businessType === 'company' && dto.company) {
      accountData.company = {
        name: dto.company.name,
        tax_id: dto.company.taxId,
        address: {
          line1: dto.company.address.line1,
          city: dto.company.address.city,
          postal_code: dto.company.address.postalCode,
          country: dto.company.address.country,
        },
      };
    }

    const stripeAccount = await this.stripeService.getStripe().accounts.create(accountData);

    // Save to database
    const connectedAccount = await this.prisma.connectedAccount.create({
      data: {
        userId,
        stripeAccountId: stripeAccount.id,
        email: dto.email,
        country: dto.country,
        businessType: dto.businessType || 'individual',
        status: stripeAccount.charges_enabled ? 'active' : 'pending',
      },
    });

    // Create onboarding link if account is not fully onboarded
    let onboardingUrl: string | undefined;
    if (!stripeAccount.charges_enabled) {
      const accountLink = await this.stripeService.getStripe().accountLinks.create({
        account: stripeAccount.id,
        refresh_url: `${this.configService.get('FRONTEND_URL')}/connect/onboarding?refresh=true`,
        return_url: `${this.configService.get('FRONTEND_URL')}/connect/onboarding?success=true`,
        type: 'account_onboarding',
      });
      onboardingUrl = accountLink.url;
    }

    this.logger.log(`Created connected account ${stripeAccount.id} for user ${userId}`);

    return { account: connectedAccount, onboardingUrl };
  }

  async getConnectedAccount(userId: string): Promise<{
    id: string;
    userId: string;
    stripeAccountId: string;
    email: string;
    country: string;
    businessType: string;
    status: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    createdAt: Date;
    updatedAt: Date;
    stripeData: {
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      requirements: Stripe.Account.Requirements | null | undefined;
    };
  }> {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundException('Connected account not found');
    }

    // Get fresh data from Stripe
    const stripeAccount = await this.stripeService.getStripe().accounts.retrieve(
      account.stripeAccountId,
    );

    // Update status if changed
    const newStatus = stripeAccount.charges_enabled ? 'active' : 'pending';
    if (account.status !== newStatus) {
      await this.prisma.connectedAccount.update({
        where: { id: account.id },
        data: { status: newStatus },
      });
      account.status = newStatus;
    }

    return {
      ...account,
      stripeData: {
        chargesEnabled: stripeAccount.charges_enabled,
        payoutsEnabled: stripeAccount.payouts_enabled,
        requirements: stripeAccount.requirements,
      },
    };
  }

  async createOnboardingLink(userId: string): Promise<{ url: string }> {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundException('Connected account not found');
    }

    const accountLink = await this.stripeService.getStripe().accountLinks.create({
      account: account.stripeAccountId,
      refresh_url: `${this.configService.get('FRONTEND_URL')}/connect/onboarding?refresh=true`,
      return_url: `${this.configService.get('FRONTEND_URL')}/connect/onboarding?success=true`,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  async createLoginLink(userId: string): Promise<{ url: string }> {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      throw new NotFoundException('Connected account not found');
    }

    const loginLink = await this.stripeService.getStripe().accounts.createLoginLink(
      account.stripeAccountId,
    );

    return { url: loginLink.url };
  }

  async createDirectCharge(
    params: {
      amount: number;
      currency: string;
      connectedAccountId: string;
      paymentMethodId: string;
      description?: string;
      applicationFeeAmount?: number;
    },
  ): Promise<{ paymentIntentId: string; clientSecret: string }> {
    const connectedAccount = await this.prisma.connectedAccount.findUnique({
      where: { id: params.connectedAccountId },
    });

    if (!connectedAccount) {
      throw new NotFoundException('Connected account not found');
    }

    if (connectedAccount.status !== 'active') {
      throw new BadRequestException('Connected account is not active');
    }

    // Get payment method
    const paymentMethod = await this.prisma.paymentMethod.findUnique({
      where: { id: params.paymentMethodId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    // Calculate application fee
    const applicationFeeAmount = params.applicationFeeAmount || 
      Math.round(params.amount * (this.platformFeePercent / 100));

    // Create PaymentIntent with transfer_data
    const paymentIntent = await this.stripeService.getStripe().paymentIntents.create({
      amount: params.amount,
      currency: params.currency,
      payment_method: paymentMethod.stripePmId,
      confirmation_method: 'manual',
      confirm: true,
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: connectedAccount.stripeAccountId,
      },
      description: params.description,
    });

    this.logger.log(`Created direct charge ${paymentIntent.id} for account ${connectedAccount.stripeAccountId}`);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
    };
  }

  async createTransfer(dto: CreateTransferDto): Promise<ReturnType<typeof this.prisma.transfer.create>> {
    const connectedAccount = await this.prisma.connectedAccount.findUnique({
      where: { id: dto.destinationAccountId },
    });

    if (!connectedAccount) {
      throw new NotFoundException('Connected account not found');
    }

    const transfer = await this.stripeService.getStripe().transfers.create({
      amount: dto.amount,
      currency: dto.currency,
      destination: connectedAccount.stripeAccountId,
      description: dto.description,
    });

    // Save to database
    const transferRecord = await this.prisma.transfer.create({
      data: {
        stripeTransferId: transfer.id,
        connectedAccountId: connectedAccount.id,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
        status: 'paid',
      },
    });

    this.logger.log(`Created transfer ${transfer.id} to account ${connectedAccount.stripeAccountId}`);

    return transferRecord;
  }

  async getTransfers(connectedAccountId: string): Promise<ReturnType<typeof this.prisma.transfer.findMany>> {
    const transfers = await this.prisma.transfer.findMany({
      where: { connectedAccountId },
      orderBy: { createdAt: 'desc' },
    });

    return transfers;
  }

  async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    const connectedAccount = await this.prisma.connectedAccount.findUnique({
      where: { stripeAccountId: account.id },
    });

    if (!connectedAccount) {
      this.logger.warn(`Connected account ${account.id} not found in database`);
      return;
    }

    const newStatus = account.charges_enabled ? 'active' : 'pending';
    
    await this.prisma.connectedAccount.update({
      where: { id: connectedAccount.id },
      data: {
        status: newStatus,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      },
    });

    this.logger.log(`Updated connected account ${account.id} status to ${newStatus}`);
  }

  async getPlatformBalance(): Promise<{
    available: number;
    pending: number;
    currency: string;
  }> {
    const balance = await this.stripeService.getStripe().balance.retrieve();

    const available = balance.available.reduce((sum, b) => sum + b.amount, 0);
    const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0);

    return {
      available,
      pending,
      currency: balance.available[0]?.currency || 'usd',
    };
  }
}
