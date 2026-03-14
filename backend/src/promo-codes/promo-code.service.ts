import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { RedisService } from '../redis/redis.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';

export type { CreatePromoCodeDto } from './dto/create-promo-code.dto';

export interface ValidatePromoCodeResult {
  valid: boolean;
  code?: string;
  name?: string;
  description?: string;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration?: string;
  durationInMonths?: number;
  error?: string;
}

@Injectable()
export class PromoCodeService {
  private readonly logger = new Logger(PromoCodeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
  ) {}

  async createPromoCode(dto: CreatePromoCodeDto): Promise<any> {
    // Validate code format
    if (!/^[A-Z0-9_-]{3,50}$/i.test(dto.code)) {
      throw new BadRequestException('Code must be 3-50 alphanumeric characters');
    }

    // Check if code already exists
    const existing = await this.prisma.promoCode.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new BadRequestException('Promo code already exists');
    }

    // Validate discount
    if (!dto.percentOff && !dto.amountOff) {
      throw new BadRequestException('Must specify either percentOff or amountOff');
    }

    if (dto.percentOff && (dto.percentOff < 1 || dto.percentOff > 100)) {
      throw new BadRequestException('Percent off must be between 1 and 100');
    }

    // Create coupon in Stripe
    const couponData: any = {
      name: dto.name,
      duration: dto.duration,
    };

    if (dto.percentOff) {
      couponData.percent_off = dto.percentOff;
    } else if (dto.amountOff) {
      couponData.amount_off = dto.amountOff;
      couponData.currency = dto.currency || 'usd';
    }

    if (dto.duration === 'repeating' && dto.durationInMonths) {
      couponData.duration_in_months = dto.durationInMonths;
    }

    if (dto.maxRedemptions) {
      couponData.max_redemptions = dto.maxRedemptions;
    }

    if (dto.redeemBy) {
      couponData.redeem_by = Math.floor(dto.redeemBy.getTime() / 1000);
    }

    if (dto.appliesToProducts && dto.appliesToProducts.length > 0) {
      couponData.applies_to = { products: dto.appliesToProducts };
    }

    const stripeCoupon = await this.stripeService.getStripe().coupons.create(couponData);

    // Create promo code in Stripe (customer-facing code)
    const stripePromoCode = await this.stripeService.getStripe().promotionCodes.create({
      coupon: stripeCoupon.id,
      code: dto.code.toUpperCase(),
    });

    // Save to database
    const promoCode = await this.prisma.promoCode.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        stripeCouponId: stripeCoupon.id,
        stripePromoCodeId: stripePromoCode.id,
        percentOff: dto.percentOff,
        amountOff: dto.amountOff,
        currency: dto.currency,
        duration: dto.duration,
        durationInMonths: dto.durationInMonths,
        maxRedemptions: dto.maxRedemptions,
        redeemBy: dto.redeemBy,
        isActive: true,
      },
    });

    this.logger.log(`Created promo code: ${dto.code}`);
    return promoCode;
  }

  async validatePromoCode(code: string): Promise<ValidatePromoCodeResult> {
    if (!code) {
      return { valid: false, error: 'Code is required' };
    }

    // Check cache first
    const cacheKey = `promo:${code.toUpperCase()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const promoCode = await this.prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promoCode) {
      return { valid: false, error: 'Invalid promo code' };
    }

    if (!promoCode.isActive) {
      return { valid: false, error: 'Promo code is inactive' };
    }

    if (promoCode.redeemBy && new Date() > promoCode.redeemBy) {
      return { valid: false, error: 'Promo code has expired' };
    }

    // Check Stripe for current status
    try {
      const stripePromoCode = await this.stripeService.getStripe().promotionCodes.retrieve(
        promoCode.stripePromoCodeId,
      );

      if (!stripePromoCode.active) {
        await this.prisma.promoCode.update({
          where: { id: promoCode.id },
          data: { isActive: false },
        });
        return { valid: false, error: 'Promo code is no longer active' };
      }
    } catch (error) {
      this.logger.error(`Failed to verify promo code with Stripe: ${error.message}`);
    }

    const result: ValidatePromoCodeResult = {
      valid: true,
      code: promoCode.code,
      name: promoCode.name,
      description: promoCode.description || undefined,
      percentOff: promoCode.percentOff || undefined,
      amountOff: promoCode.amountOff || undefined,
      currency: promoCode.currency || undefined,
      duration: promoCode.duration,
      durationInMonths: promoCode.durationInMonths || undefined,
    };

    // Cache for 5 minutes
    await this.redisService.set(cacheKey, JSON.stringify(result), 300);

    return result;
  }

  async applyPromoCodeToSubscription(
    subscriptionId: string,
    promoCodeId: string,
  ): Promise<void> {
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { id: promoCodeId },
    });

    if (!promoCode) {
      throw new NotFoundException('Promo code not found');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Update Stripe subscription with coupon
    await this.stripeService.getStripe().subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        coupon: promoCode.stripeCouponId,
      },
    );

    // Record usage
    await this.prisma.promoCodeUsage.create({
      data: {
        promoCodeId: promoCode.id,
        subscriptionId: subscription.id,
        userId: subscription.userId,
      },
    });

    // Increment times used
    await this.prisma.promoCode.update({
      where: { id: promoCode.id },
      data: { timesUsed: { increment: 1 } },
    });

    // Clear cache
    await this.redisService.del(`promo:${promoCode.code}`);

    this.logger.log(`Applied promo code ${promoCode.code} to subscription ${subscriptionId}`);
  }

  async getPromoCodes(params: {
    active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ codes: any[]; total: number }> {
    const { active, limit = 50, offset = 0 } = params;

    const where: any = {};
    if (active !== undefined) {
      where.isActive = active;
    }

    const [codes, total] = await Promise.all([
      this.prisma.promoCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.promoCode.count({ where }),
    ]);

    return { codes, total };
  }

  async getPromoCode(id: string): Promise<any> {
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { id },
      include: {
        usages: {
          include: {
            user: { select: { email: true, name: true } },
            subscription: { select: { status: true } },
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!promoCode) {
      throw new NotFoundException('Promo code not found');
    }

    return promoCode;
  }

  async deactivatePromoCode(id: string): Promise<void> {
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promoCode) {
      throw new NotFoundException('Promo code not found');
    }

    // Deactivate in Stripe
    await this.stripeService.getStripe().promotionCodes.update(
      promoCode.stripePromoCodeId,
      { active: false },
    );

    // Update database
    await this.prisma.promoCode.update({
      where: { id },
      data: { isActive: false },
    });

    // Clear cache
    await this.redisService.del(`promo:${promoCode.code}`);

    this.logger.log(`Deactivated promo code: ${promoCode.code}`);
  }

  async deletePromoCode(id: string): Promise<void> {
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promoCode) {
      throw new NotFoundException('Promo code not found');
    }

    // Delete from Stripe (archive)
    await this.stripeService.getStripe().coupons.del(promoCode.stripeCouponId);

    // Delete from database
    await this.prisma.promoCode.delete({
      where: { id },
    });

    // Clear cache
    await this.redisService.del(`promo:${promoCode.code}`);

    this.logger.log(`Deleted promo code: ${promoCode.code}`);
  }
}
