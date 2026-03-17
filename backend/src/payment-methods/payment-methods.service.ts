import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import Stripe from 'stripe';

type StripePaymentMethod = Stripe.PaymentMethod;

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async createSetupIntent(
    userId: string,
    stripeCustomerId: string,
    paymentMethodId?: string,
  ): Promise<{ clientSecret: string }> {
    const setupIntent = await this.stripeService.createSetupIntent(
      stripeCustomerId,
      { userId },
      paymentMethodId,
    );

    if (!setupIntent.client_secret) {
      throw new Error('Failed to create setup intent');
    }

    return { clientSecret: setupIntent.client_secret };
  }

  async savePaymentMethod(
    userId: string,
    stripePaymentMethodId: string,
    stripeCustomerId: string,
  ): Promise<PaymentMethodEntity> {
    // 1. Check if payment method already exists in our database
    const existing = await this.prisma.paymentMethod.findFirst({
      where: { userId, stripePmId: stripePaymentMethodId },
    });

    if (existing) {
      if (existing.isActive) {
        // Already saved and active - return existing
        return this.toEntity(existing);
      }
      // Was soft-deleted - reactivate it
      const reactivated = await this.prisma.paymentMethod.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      return this.toEntity(reactivated);
    }

    // 2. Try to attach to Stripe customer
    let stripePm: StripePaymentMethod;
    try {
      stripePm = await this.stripeService.attachPaymentMethod(
        stripePaymentMethodId,
        stripeCustomerId,
      );
    } catch (attachError: any) {
      // If already attached to this customer, fetch the payment method details
      if (
        attachError?.code === 'resource_already_attached' ||
        attachError?.message?.includes('already attached')
      ) {
        stripePm = await this.stripeService.getPaymentMethod(stripePaymentMethodId);
      } else {
        throw attachError;
      }
    }

    // 3. Check if this is the first payment method
    const isFirstPaymentMethod = !(await this.prisma.paymentMethod.findFirst({
      where: { userId, isActive: true },
    }));

    // 4. Extract type-specific data
    const typeData = this.extractPaymentMethodData(stripePm);

    // 5. Save to database
    const paymentMethod = await this.prisma.paymentMethod.create({
      data: {
        userId,
        stripePmId: stripePaymentMethodId,
        type: stripePm.type,
        ...typeData,
        isDefault: isFirstPaymentMethod,
      },
    });

    // 6. If first, also update user record
    if (isFirstPaymentMethod) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { defaultPaymentMethodId: paymentMethod.id },
      });
    }

    return this.toEntity(paymentMethod);
  }

  private extractPaymentMethodData(stripePm: StripePaymentMethod): Record<string, any> {
    const data: Record<string, any> = {};

    switch (stripePm.type) {
      case 'card':
        if (stripePm.card) {
          data.brand = stripePm.card.brand;
          data.last4 = stripePm.card.last4;
          data.expMonth = stripePm.card.exp_month;
          data.expYear = stripePm.card.exp_year;
        }
        break;

      case 'us_bank_account':
        if (stripePm.us_bank_account) {
          data.bankName = stripePm.us_bank_account.bank_name;
          data.last4 = stripePm.us_bank_account.last4;
          data.accountType = stripePm.us_bank_account.account_type;
        }
        break;

      case 'sepa_debit':
        if (stripePm.sepa_debit) {
          data.bankCode = stripePm.sepa_debit.bank_code;
          data.last4 = stripePm.sepa_debit.last4;
          data.country = stripePm.sepa_debit.country;
        }
        break;

      default:
        // Fallback for other payment method types
        if ((stripePm as any).last4) {
          data.last4 = (stripePm as any).last4;
        }
    }

    return data;
  }

  async findByUser(userId: string): Promise<PaymentMethodEntity[]> {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { userId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return methods.map((m) => this.toEntity(m));
  }

  async setDefault(
    userId: string,
    paymentMethodId: string,
  ): Promise<PaymentMethodEntity> {
    // Verify payment method belongs to user
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId, isActive: true },
    });

    if (!pm) {
      throw new NotFoundException('Payment method not found');
    }

    // Update all user's payment methods
    await this.prisma.$transaction([
      this.prisma.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { isDefault: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { defaultPaymentMethodId: paymentMethodId },
      }),
    ]);

    return this.toEntity(
      await this.prisma.paymentMethod.findUnique({
        where: { id: paymentMethodId },
      }),
    );
  }

  async remove(
    userId: string,
    paymentMethodId: string,
  ): Promise<PaymentMethodEntity> {
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
    });

    if (!pm) {
      throw new NotFoundException('Payment method not found');
    }

    // Detach from Stripe
    await this.stripeService.detachPaymentMethod(pm.stripePmId);

    // Soft delete in database
    const updated = await this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isActive: false, isDefault: false },
    });

    // If this was the default, clear it from user
    if (pm.isDefault) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { defaultPaymentMethodId: null },
      });

      // Set another as default if available
      const nextDefault = await this.prisma.paymentMethod.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (nextDefault) {
        await this.setDefault(userId, nextDefault.id);
      }
    }

    return this.toEntity(updated);
  }

  async getDefaultForUser(userId: string): Promise<PaymentMethodEntity | null> {
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { userId, isDefault: true, isActive: true },
    });

    return pm ? this.toEntity(pm) : null;
  }

  private toEntity(pm: any): PaymentMethodEntity {
    return {
      id: pm.id,
      stripePmId: pm.stripePmId,
      type: pm.type,
      // Card fields
      brand: pm.brand,
      last4: pm.last4,
      expMonth: pm.expMonth,
      expYear: pm.expYear,
      // Bank account fields
      bankName: pm.bankName,
      accountType: pm.accountType,
      // SEPA fields
      bankCode: pm.bankCode,
      country: pm.country,
      // Wallet fields
      walletType: pm.walletType,
      // Common fields
      isDefault: pm.isDefault,
      isActive: pm.isActive,
      createdAt: pm.createdAt,
    };
  }
}
