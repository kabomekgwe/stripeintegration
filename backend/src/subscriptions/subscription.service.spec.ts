import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { MailService } from '../mail/mail.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionStatus } from './entities/subscription.entity';
import { createSubscriptionFactory, createPlanFactory, createPriceFactory } from '../../test/factories/subscription.factory';
import { createUserFactory } from '../../test/factories/user.factory';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prismaService: PrismaService;
  let stripeService: StripeService;
  let mailService: MailService;

  const mockStripe = {
    subscriptions: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: PrismaService,
          useValue: {
            plan: {
              findMany: vi.fn(),
              findUnique: vi.fn(),
            },
            price: {
              findUnique: vi.fn(),
            },
            subscription: {
              findFirst: vi.fn(),
              findMany: vi.fn(),
              findUnique: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
            },
            paymentMethod: {
              findFirst: vi.fn(),
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            getStripe: vi.fn().mockReturnValue(mockStripe),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendBillingEmail: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    prismaService = module.get(PrismaService);
    stripeService = module.get(StripeService);
    mailService = module.get(MailService);

    vi.clearAllMocks();
  });

  describe('getActivePlans', () => {
    it('should return active plans with prices', async () => {
      const mockPlans = [
        createPlanFactory({ name: 'Basic Plan' }),
        createPlanFactory({ name: 'Pro Plan' }),
      ];

      prismaService.plan.findMany = vi.fn().mockResolvedValue(mockPlans);

      const result = await service.getActivePlans();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Basic Plan');
      expect(result[0].prices).toBeDefined();
      expect(prismaService.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          prices: {
            where: { isActive: true },
            orderBy: { amount: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no plans exist', async () => {
      prismaService.plan.findMany = vi.fn().mockResolvedValue([]);

      const result = await service.getActivePlans();

      expect(result).toEqual([]);
    });
  });

  describe('getPlanById', () => {
    it('should return plan by id', async () => {
      const mockPlan = createPlanFactory({ id: 'plan-123' });

      prismaService.plan.findUnique = vi.fn().mockResolvedValue(mockPlan);

      const result = await service.getPlanById('plan-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('plan-123');
      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan-123', isActive: true },
        include: {
          prices: {
            where: { isActive: true },
          },
        },
      });
    });

    it('should return null when plan not found', async () => {
      prismaService.plan.findUnique = vi.fn().mockResolvedValue(null);

      const result = await service.getPlanById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createSubscription', () => {
    const mockUser = createUserFactory();
    const mockPrice = createPriceFactory();
    const mockPlan = createPlanFactory({
      id: mockPrice.planId,
      prices: [mockPrice],
    });

    beforeEach(() => {
      prismaService.price.findUnique = vi.fn().mockResolvedValue({
        ...mockPrice,
        plan: mockPlan,
      });
      prismaService.subscription.findFirst = vi.fn().mockResolvedValue(null);
      prismaService.paymentMethod.findFirst = vi.fn().mockResolvedValue(null);
    });

    it('should create subscription successfully', async () => {
      const mockStripeSubscription = {
        id: 'sub_123',
        status: 'incomplete',
        current_period_start: Date.now() / 1000,
        current_period_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
        cancel_at_period_end: false,
        latest_invoice: {
          payment_intent: {
            client_secret: 'pi_secret_123',
          },
        },
      };

      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      prismaService.subscription.create = vi.fn().mockResolvedValue({
        id: 'sub-db-123',
        userId: mockUser.id,
      });

      const result = await service.createSubscription(
        mockUser.id,
        mockUser.stripeCustomerId!,
        { priceId: mockPrice.id },
      );

      expect(result.clientSecret).toBe('pi_secret_123');
      expect(result.subscriptionId).toBe('sub_123');
      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: mockUser.stripeCustomerId,
        items: [{ price: mockPrice.stripePriceId }],
        default_payment_method: undefined,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: mockUser.id,
          planId: mockPrice.planId,
          priceId: mockPrice.id,
        },
      });
    });

    it('should throw NotFoundException when price not found', async () => {
      prismaService.price.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        service.createSubscription(mockUser.id, mockUser.stripeCustomerId!, {
          priceId: 'invalid-price',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user has active subscription', async () => {
      prismaService.subscription.findFirst = vi.fn().mockResolvedValue({
        id: 'existing-sub',
        status: 'ACTIVE',
      });

      await expect(
        service.createSubscription(mockUser.id, mockUser.stripeCustomerId!, {
          priceId: mockPrice.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use provided payment method', async () => {
      const mockPaymentMethod = {
        id: 'pm-123',
        stripePmId: 'pm_stripe_123',
      };

      prismaService.paymentMethod.findFirst = vi
        .fn()
        .mockResolvedValue(mockPaymentMethod);

      const mockStripeSubscription = {
        id: 'sub_123',
        status: 'incomplete',
        current_period_start: Date.now() / 1000,
        current_period_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
        cancel_at_period_end: false,
        latest_invoice: {
          payment_intent: {
            client_secret: 'pi_secret_123',
          },
        },
      };

      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      prismaService.subscription.create = vi.fn().mockResolvedValue({
        id: 'sub-db-123',
      });

      await service.createSubscription(
        mockUser.id,
        mockUser.stripeCustomerId!,
        { priceId: mockPrice.id, paymentMethodId: 'pm-123' },
      );

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          default_payment_method: 'pm_stripe_123',
        }),
      );
    });

    it('should throw BadRequestException when client secret is missing', async () => {
      const mockStripeSubscription = {
        id: 'sub_123',
        status: 'incomplete',
        latest_invoice: {},
      };

      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);

      await expect(
        service.createSubscription(mockUser.id, mockUser.stripeCustomerId!, {
          priceId: mockPrice.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when payment method not found', async () => {
      prismaService.paymentMethod.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.createSubscription(mockUser.id, mockUser.stripeCustomerId!, {
          priceId: mockPrice.id,
          paymentMethodId: 'invalid-pm',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserSubscription', () => {
    it('should return user active subscription', async () => {
      const mockSubscription = createSubscriptionFactory({
        status: SubscriptionStatus.ACTIVE,
      });

      prismaService.subscription.findFirst = vi
        .fn()
        .mockResolvedValue(mockSubscription);

      const result = await service.getUserSubscription('user-123');

      expect(result).toBeDefined();
      expect(result?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(prismaService.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          status: { notIn: ['CANCELED'] },
        },
        include: {
          plan: true,
          price: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return null when no active subscription', async () => {
      prismaService.subscription.findFirst = vi.fn().mockResolvedValue(null);

      const result = await service.getUserSubscription('user-123');

      expect(result).toBeNull();
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return all user subscriptions', async () => {
      const mockSubscriptions = [
        createSubscriptionFactory({ status: SubscriptionStatus.ACTIVE }),
        createSubscriptionFactory({ status: SubscriptionStatus.CANCELED }),
      ];

      prismaService.subscription.findMany = vi
        .fn()
        .mockResolvedValue(mockSubscriptions);

      const result = await service.getUserSubscriptions('user-123');

      expect(result).toHaveLength(2);
      expect(prismaService.subscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: { plan: true, price: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateSubscription', () => {
    const mockSubscription = createSubscriptionFactory();
    const mockStripeSub = {
      items: {
        data: [{ id: 'si_123' }],
      },
    };

    beforeEach(() => {
      prismaService.subscription.findFirst = vi
        .fn()
        .mockResolvedValue(mockSubscription);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSub);
    });

    it('should update subscription price', async () => {
      const newPrice = createPriceFactory({
        id: 'price-new',
        stripePriceId: 'price_stripe_new',
      });

      prismaService.price.findUnique = vi.fn().mockResolvedValue(newPrice);
      prismaService.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscription,
        priceId: newPrice.id,
      });

      const result = await service.updateSubscription(
        mockSubscription.id,
        mockSubscription.userId,
        { priceId: newPrice.id },
      );

      expect(result.message).toBe('Subscription updated');
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        mockSubscription.stripeSubscriptionId,
        {
          items: [
            {
              id: 'si_123',
              price: newPrice.stripePriceId,
            },
          ],
          proration_behavior: 'always_invoice',
        },
      );
    });

    it('should update cancelAtPeriodEnd', async () => {
      prismaService.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });

      const result = await service.updateSubscription(
        mockSubscription.id,
        mockSubscription.userId,
        { cancelAtPeriodEnd: true },
      );

      expect(result.message).toBe('Subscription updated');
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        mockSubscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        },
      );
    });

    it('should throw NotFoundException when subscription not found', async () => {
      prismaService.subscription.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.updateSubscription('invalid-id', 'user-123', {
          priceId: 'price-123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when new price not found', async () => {
      prismaService.price.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        service.updateSubscription(
          mockSubscription.id,
          mockSubscription.userId,
          { priceId: 'invalid-price' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not update if priceId is the same', async () => {
      const result = await service.updateSubscription(
        mockSubscription.id,
        mockSubscription.userId,
        { priceId: mockSubscription.priceId },
      );

      expect(result.message).toBe('Subscription updated');
      expect(mockStripe.subscriptions.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ items: expect.anything() }),
      );
    });
  });

  describe('cancelSubscription', () => {
    const mockSubscription = createSubscriptionFactory({
      status: SubscriptionStatus.ACTIVE,
    });

    beforeEach(() => {
      prismaService.subscription.findFirst = vi
        .fn()
        .mockResolvedValue(mockSubscription);
    });

    it('should cancel subscription immediately', async () => {
      mockStripe.subscriptions.cancel.mockResolvedValue({});
      prismaService.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELED,
      });

      const result = await service.cancelSubscription(
        mockSubscription.id,
        mockSubscription.userId,
        { cancelMode: 'immediately' },
      );

      expect(result.message).toContain('immediately');
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith(
        mockSubscription.stripeSubscriptionId,
      );
      expect(mailService.sendBillingEmail).toHaveBeenCalledWith(
        mockSubscription.userId,
        'SUBSCRIPTION_CANCELED',
        expect.any(Object),
      );
    });

    it('should cancel subscription at period end', async () => {
      mockStripe.subscriptions.update.mockResolvedValue({});
      prismaService.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });

      const result = await service.cancelSubscription(
        mockSubscription.id,
        mockSubscription.userId,
        { cancelMode: 'period_end' },
      );

      expect(result.message).toContain('period end');
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        mockSubscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        },
      );
    });

    it('should throw NotFoundException when subscription not found', async () => {
      prismaService.subscription.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.cancelSubscription('invalid-id', 'user-123', {
          cancelMode: 'immediately',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleStripeSubscriptionUpdated', () => {
    it('should update subscription status', async () => {
      const mockSubscription = createSubscriptionFactory({
        status: SubscriptionStatus.INCOMPLETE,
      });

      prismaService.subscription.findUnique = vi
        .fn()
        .mockResolvedValue(mockSubscription);
      prismaService.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      });

      const stripeSub = {
        id: mockSubscription.stripeSubscriptionId,
        status: 'active',
        current_period_start: Date.now() / 1000,
        current_period_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
        cancel_at_period_end: false,
        canceled_at: null,
        trial_end: null,
      };

      await service.handleStripeSubscriptionUpdated(stripeSub);

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
        }),
      });
    });

    it('should send email when trial ends', async () => {
      const mockSubscription = createSubscriptionFactory({
        status: SubscriptionStatus.TRIALING,
      });

      prismaService.subscription.findUnique = vi
        .fn()
        .mockResolvedValue(mockSubscription);
      prismaService.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      });

      const stripeSub = {
        id: mockSubscription.stripeSubscriptionId,
        status: 'active',
        current_period_start: Date.now() / 1000,
        current_period_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
        cancel_at_period_end: false,
        canceled_at: null,
        trial_end: null,
      };

      await service.handleStripeSubscriptionUpdated(stripeSub);

      expect(mailService.sendBillingEmail).toHaveBeenCalledWith(
        mockSubscription.userId,
        'TRIAL_ENDED',
        expect.any(Object),
      );
    });

    it('should send email when subscription becomes past due', async () => {
      const mockSubscription = createSubscriptionFactory({
        status: SubscriptionStatus.ACTIVE,
      });

      prismaService.subscription.findUnique = vi
        .fn()
        .mockResolvedValue(mockSubscription);
      prismaService.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.PAST_DUE,
      });

      const stripeSub = {
        id: mockSubscription.stripeSubscriptionId,
        status: 'past_due',
        current_period_start: Date.now() / 1000,
        current_period_end: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000,
        cancel_at_period_end: false,
        canceled_at: null,
        trial_end: null,
      };

      await service.handleStripeSubscriptionUpdated(stripeSub);

      expect(mailService.sendBillingEmail).toHaveBeenCalledWith(
        mockSubscription.userId,
        'SUBSCRIPTION_PAST_DUE',
        expect.any(Object),
      );
    });

    it('should handle subscription not found', async () => {
      prismaService.subscription.findUnique = vi.fn().mockResolvedValue(null);

      const stripeSub = {
        id: 'sub_nonexistent',
        status: 'active',
      };

      // Should not throw
      await expect(
        service.handleStripeSubscriptionUpdated(stripeSub),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleStripeSubscriptionDeleted', () => {
    it('should mark subscription as canceled', async () => {
      const mockSubscription = createSubscriptionFactory({
        status: SubscriptionStatus.ACTIVE,
      });

      prismaService.subscription.findUnique = vi
        .fn()
        .mockResolvedValue(mockSubscription);
      prismaService.subscription.update = vi.fn().mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELED,
      });

      const stripeSub = {
        id: mockSubscription.stripeSubscriptionId,
      };

      await service.handleStripeSubscriptionDeleted(stripeSub);

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        data: {
          status: SubscriptionStatus.CANCELED,
          canceledAt: expect.any(Date),
        },
      });
    });

    it('should handle subscription not found', async () => {
      prismaService.subscription.findUnique = vi.fn().mockResolvedValue(null);

      const stripeSub = {
        id: 'sub_nonexistent',
      };

      // Should not throw
      await expect(
        service.handleStripeSubscriptionDeleted(stripeSub),
      ).resolves.toBeUndefined();
    });
  });

  describe('mapStripeStatus', () => {
    it('should map all Stripe statuses correctly', () => {
      const testCases = [
        { input: 'incomplete', expected: SubscriptionStatus.INCOMPLETE },
        { input: 'incomplete_expired', expected: SubscriptionStatus.INCOMPLETE_EXPIRED },
        { input: 'trialing', expected: SubscriptionStatus.TRIALING },
        { input: 'active', expected: SubscriptionStatus.ACTIVE },
        { input: 'past_due', expected: SubscriptionStatus.PAST_DUE },
        { input: 'canceled', expected: SubscriptionStatus.CANCELED },
        { input: 'unpaid', expected: SubscriptionStatus.UNPAID },
        { input: 'paused', expected: SubscriptionStatus.PAUSED },
        { input: 'unknown', expected: SubscriptionStatus.INCOMPLETE },
      ];

      for (const { input, expected } of testCases) {
        // Access private method through any cast
        const result = (service as any).mapStripeStatus(input);
        expect(result).toBe(expected);
      }
    });
  });
});
