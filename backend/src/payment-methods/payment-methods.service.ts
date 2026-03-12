import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodEntity } from './entities/payment-method.entity';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  async createSetupIntent(
    userId: string,
    stripeCustomerId: string,
  ): Promise<{ clientSecret: string }> {
    const setupIntent = await this.stripeService.createSetupIntent(
      stripeCustomerId,
      { userId },
    );

    return { clientSecret: setupIntent.client_secret };
  }

  async savePaymentMethod(
    userId: string,
    stripePaymentMethodId: string,
    stripeCustomerId: string,
  ): Promise<PaymentMethodEntity> {
    // Attach to customer in Stripe
    const stripePm = await this.stripeService.attachPaymentMethod(
      stripePaymentMethodId,
      stripeCustomerId,
    );

    // Save to database
    const isFirstPaymentMethod = !(await this.prisma.paymentMethod.findFirst({
      where: { userId, isActive: true },
    }));

    const paymentMethod = await this.prisma.paymentMethod.create({
      data: {
        userId,
        stripePmId: stripePaymentMethodId,
        type: stripePm.type,
        brand: stripePm.card?.brand,
        last4: stripePm.card?.last4,
        expMonth: stripePm.card?.exp_month,
        expYear: stripePm.card?.exp_year,
        isDefault: isFirstPaymentMethod, // First one becomes default
      },
    });

    // If it's the first, also update user record
    if (isFirstPaymentMethod) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { defaultPaymentMethodId: paymentMethod.id },
      });
    }

    return this.toEntity(paymentMethod);
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
      brand: pm.brand,
      last4: pm.last4,
      expMonth: pm.expMonth,
      expYear: pm.expYear,
      isDefault: pm.isDefault,
      isActive: pm.isActive,
      createdAt: pm.createdAt,
    };
  }
}
