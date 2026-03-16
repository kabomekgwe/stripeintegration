import { Test } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { TaxService } from '../tax/tax.service';
import { CurrencyService } from '../currency/currency.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, RefundStatus } from '@prisma/client';
import { createPaymentFactory, createPaymentRecordFactory, createRefundFactory } from '../../test/factories/payment.factory';
import { createUserFactory } from '../../test/factories/user.factory';
import { createMockRedisService } from '../../test/mocks/redis.mock';

describe('PaymentsService', () => {
  let paymentsService: PaymentsService;
  let prismaService: PrismaService;
  let stripeService: StripeService;
  let paymentMethodsService: PaymentMethodsService;
  let redisService: RedisService;
  let mailService: MailService;
  let taxService: TaxService;
  let currencyService: CurrencyService;
  let configService: ConfigService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            paymentRecord: {
              create: vi.fn(),
              findFirst: vi.fn(),
              findMany: vi.fn(),
              update: vi.fn(),
            },
            paymentMethod: {
              findFirst: vi.fn(),
            },
            refund: {
              create: vi.fn(),
              findMany: vi.fn(),
            },
            $transaction: vi.fn().mockImplementation((callback) => callback()),
          },
        },
        {
          provide: StripeService,
          useValue: {
            createPaymentIntent: vi.fn(),
            retrievePaymentIntent: vi.fn(),
            confirmPaymentIntent: vi.fn(),
            createRefund: vi.fn(),
          },
        },
        {
          provide: PaymentMethodsService,
          useValue: {
            getDefaultForUser: vi.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: createMockRedisService(),
        },
        {
          provide: MailService,
          useValue: {
            sendPaymentReceipt: vi.fn().mockResolvedValue(undefined),
            sendPaymentFailed: vi.fn().mockResolvedValue(undefined),
            sendRefundConfirmation: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TaxService,
          useValue: {
            isTaxEnabled: vi.fn().mockReturnValue(false),
            calculateTax: vi.fn(),
          },
        },
        {
          provide: CurrencyService,
          useValue: {
            validateAmount: vi.fn().mockReturnValue({ valid: true }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue('http://localhost:3000'),
          },
        },
      ],
    }).compile();

    paymentsService = moduleRef.get<PaymentsService>(PaymentsService);
    prismaService = moduleRef.get<PrismaService>(PrismaService);
    stripeService = moduleRef.get<StripeService>(StripeService);
    paymentMethodsService = moduleRef.get<PaymentMethodsService>(PaymentMethodsService);
    redisService = moduleRef.get<RedisService>(RedisService);
    mailService = moduleRef.get<MailService>(MailService);
    taxService = moduleRef.get<TaxService>(TaxService);
    currencyService = moduleRef.get<CurrencyService>(CurrencyService);
    configService = moduleRef.get<ConfigService>(ConfigService);

    vi.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    const validParams = {
      userId: 'user-123',
      stripeCustomerId: 'cus_test123',
      amount: 1000,
      currency: 'usd',
      description: 'Test payment',
    };

    it('should create payment intent with valid data', async () => {
      // Arrange
      const mockPaymentMethod = {
        id: 'pm-123',
        stripePmId: 'pm_stripe123',
      };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });
      vi.mocked(redisService.setIdempotency).mockResolvedValue(undefined);

      // Act
      const result = await paymentsService.createPaymentIntent(validParams);

      // Assert
      expect(result.clientSecret).toBe('pi_test123_secret');
      expect(result.paymentIntentId).toBe('pi_test123');
      expect(result.taxAmount).toBe(0);
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          currency: 'usd',
          customerId: 'cus_test123',
          paymentMethodId: 'pm_stripe123',
        }),
      );
    });

    it('should throw BadRequestException for invalid currency', async () => {
      // Arrange
      vi.mocked(currencyService.validateAmount).mockReturnValue({
        valid: false,
        error: 'Invalid currency',
      });

      // Act & Assert
      await expect(paymentsService.createPaymentIntent(validParams)).rejects.toThrow(
        BadRequestException,
      );
      expect(currencyService.validateAmount).toHaveBeenCalledWith(1000, 'usd');
    });

    it('should throw NotFoundException when payment method not found', async () => {
      // Arrange
      vi.mocked(prismaService.paymentMethod.findFirst).mockResolvedValue(null);

      // Act & Assert
      await expect(
        paymentsService.createPaymentIntent({
          ...validParams,
          paymentMethodId: 'non-existent-pm',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no default payment method exists', async () => {
      // Arrange
      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(null);

      // Act & Assert
      await expect(paymentsService.createPaymentIntent(validParams)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use specified payment method when provided', async () => {
      // Arrange
      const mockPaymentMethod = {
        id: 'pm-456',
        stripePmId: 'pm_specified123',
      };
      const mockStripePi = {
        id: 'pi_test456',
        client_secret: 'pi_test456_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(prismaService.paymentMethod.findFirst).mockResolvedValue(mockPaymentMethod as any);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act
      await paymentsService.createPaymentIntent({
        ...validParams,
        paymentMethodId: 'pm-456',
      });

      // Assert
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethodId: 'pm_specified123',
        }),
      );
    });

    it('should calculate and add tax when tax is enabled', async () => {
      // Arrange
      vi.mocked(taxService.isTaxEnabled).mockReturnValue(true);
      vi.mocked(taxService.calculateTax).mockResolvedValue({
        taxAmount: 100,
        taxRate: 0.1,
        taxDisplayName: 'VAT',
      });

      const mockPaymentMethod = {
        id: 'pm-123',
        stripePmId: 'pm_stripe123',
      };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act
      const result = await paymentsService.createPaymentIntent(validParams);

      // Assert
      expect(result.taxAmount).toBe(100);
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1100, // base + tax
          metadata: expect.objectContaining({
            taxAmount: '100',
            taxRate: '0.1',
          }),
        }),
      );
    });

    it('should handle Stripe API errors gracefully', async () => {
      // Arrange
      const mockPaymentMethod = {
        id: 'pm-123',
        stripePmId: 'pm_stripe123',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockRejectedValue(new Error('Stripe error'));
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act & Assert
      await expect(paymentsService.createPaymentIntent(validParams)).rejects.toThrow('Stripe error');
    });

    it('should return cached response for idempotent requests', async () => {
      // Arrange
      const mockPaymentMethod = {
        id: 'pm-123',
        stripePmId: 'pm_stripe123',
      };
      const cachedResponse = {
        clientSecret: 'cached_secret',
        paymentIntentId: 'pi_cached',
        taxAmount: 0,
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({
        exists: true,
        response: cachedResponse,
      });

      // Act
      const result = await paymentsService.createPaymentIntent(validParams);

      // Assert
      expect(result).toEqual(cachedResponse);
      expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('should create database record with correct data', async () => {
      // Arrange
      const mockPaymentMethod = {
        id: 'pm-123',
        stripePmId: 'pm_stripe123',
      };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
        metadata: { userId: 'user-123' },
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act
      await paymentsService.createPaymentIntent(validParams);

      // Assert
      expect(prismaService.paymentRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          stripePaymentIntentId: 'pi_test123',
          amount: 1000,
          currency: 'usd',
          status: 'REQUIRES_CONFIRMATION',
          paymentMethodId: undefined,
          description: 'Test payment',
        }),
      });
    });
  });

  describe('confirmPayment', () => {
    const mockUser = createUserFactory();
    const mockPaymentRecord = createPaymentRecordFactory({
      userId: mockUser.id,
      stripePaymentIntentId: 'pi_test123',
      status: 'PENDING',
    });

    beforeEach(() => {
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
      });
    });

    it('should confirm payment and update database', async () => {
      // Arrange
      const mockStripePi = {
        id: 'pi_test123',
        status: 'succeeded',
        last_payment_error: null,
      };

      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'SUCCEEDED',
      });

      // Act
      const result = await paymentsService.confirmPayment('pi_test123', mockUser.id);

      // Assert
      expect(result.status).toBe('SUCCEEDED');
      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith({
        where: { id: mockPaymentRecord.id },
        data: expect.objectContaining({
          status: 'SUCCEEDED',
          errorMessage: undefined,
        }),
      });
    });

    it('should throw NotFoundException when payment not found', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue(null);

      // Act & Assert
      await expect(
        paymentsService.confirmPayment('pi_nonexistent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should send receipt email for succeeded payments', async () => {
      // Arrange
      const mockStripePi = {
        id: 'pi_test123',
        status: 'succeeded',
        last_payment_error: null,
      };

      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'SUCCEEDED',
      });

      // Act
      await paymentsService.confirmPayment('pi_test123', mockUser.id);

      // Assert
      expect(mailService.sendPaymentReceipt).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({
          amount: mockPaymentRecord.amount,
          currency: mockPaymentRecord.currency,
        }),
        mockUser.name || mockUser.email,
      );
    });

    it('should send failure email for failed payments', async () => {
      // Arrange
      const mockStripePi = {
        id: 'pi_test123',
        status: 'requires_payment_method',
        last_payment_error: { message: 'Card declined' },
      };

      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'REQUIRES_PAYMENT_METHOD',
      });

      // Act
      await paymentsService.confirmPayment('pi_test123', mockUser.id);

      // Assert
      expect(mailService.sendPaymentFailed).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({
          amount: mockPaymentRecord.amount,
          errorMessage: 'Card declined',
        }),
        mockUser.name || mockUser.email,
        expect.any(String),
      );
    });

    it('should update error message when payment fails', async () => {
      // Arrange
      const mockStripePi = {
        id: 'pi_test123',
        status: 'requires_payment_method',
        last_payment_error: { message: 'Insufficient funds' },
      };

      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'REQUIRES_PAYMENT_METHOD',
        errorMessage: 'Insufficient funds',
      });

      // Act
      await paymentsService.confirmPayment('pi_test123', mockUser.id);

      // Assert
      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith({
        where: { id: mockPaymentRecord.id },
        data: expect.objectContaining({
          errorMessage: 'Insufficient funds',
        }),
      });
    });
  });

  describe('findByUser', () => {
    it('should return payments for user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockPayments = [
        createPaymentRecordFactory({ userId }),
        createPaymentRecordFactory({ userId }),
      ];

      vi.mocked(prismaService.paymentRecord.findMany).mockResolvedValue(mockPayments);

      // Act
      const result = await paymentsService.findByUser(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(prismaService.paymentRecord.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no payments', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findMany).mockResolvedValue([]);

      // Act
      const result = await paymentsService.findByUser('user-no-payments');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return payment when found', async () => {
      // Arrange
      const mockPayment = createPaymentRecordFactory();

      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue(mockPayment);

      // Act
      const result = await paymentsService.findById(mockPayment.id, mockPayment.userId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(mockPayment.id);
    });

    it('should return null when payment not found', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue(null);

      // Act
      const result = await paymentsService.findById('non-existent', 'user-123');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('retryPayment', () => {
    const mockUser = createUserFactory();
    const mockPaymentRecord = createPaymentRecordFactory({
      status: 'FAILED',
      stripePaymentIntentId: 'pi_test123',
    });

    beforeEach(() => {
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
      });
      vi.mocked(redisService.getRetryCount).mockResolvedValue(0);
      vi.mocked(redisService.incrementRetryCounter).mockResolvedValue(1);
    });

    it('should retry failed payment', async () => {
      // Arrange
      vi.mocked(stripeService.confirmPaymentIntent).mockResolvedValue({});

      const mockStripePi = {
        id: 'pi_test123',
        status: 'succeeded',
        last_payment_error: null,
      };
      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'SUCCEEDED',
      });

      // Act
      const result = await paymentsService.retryPayment(mockPaymentRecord.id, mockPaymentRecord.userId);

      // Assert
      expect(stripeService.confirmPaymentIntent).toHaveBeenCalledWith('pi_test123');
      expect(result.status).toBe('SUCCEEDED');
    });

    it('should throw NotFoundException when payment not found', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue(null);

      // Act & Assert
      await expect(
        paymentsService.retryPayment('non-existent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when max retries reached', async () => {
      // Arrange
      vi.mocked(redisService.getRetryCount).mockResolvedValue(3);

      // Act & Assert
      await expect(
        paymentsService.retryPayment(mockPaymentRecord.id, mockPaymentRecord.userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should increment retry counter', async () => {
      // Arrange
      vi.mocked(stripeService.confirmPaymentIntent).mockResolvedValue({});
      const mockStripePi = {
        id: 'pi_test123',
        status: 'succeeded',
        last_payment_error: null,
      };
      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'SUCCEEDED',
      });

      // Act
      await paymentsService.retryPayment(mockPaymentRecord.id, mockPaymentRecord.userId);

      // Assert
      expect(redisService.incrementRetryCounter).toHaveBeenCalledWith('pi_test123');
    });

    it('should update status to FAILED on Stripe error', async () => {
      // Arrange
      const stripeError = new Error('Card declined');
      vi.mocked(stripeService.confirmPaymentIntent).mockRejectedValue(stripeError);

      // Act & Assert
      await expect(
        paymentsService.retryPayment(mockPaymentRecord.id, mockPaymentRecord.userId),
      ).rejects.toThrow(stripeError);

      expect(prismaService.paymentRecord.update).toHaveBeenCalledWith({
        where: { id: mockPaymentRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Card declined',
        },
      });
    });
  });

  describe('createRefund', () => {
    const mockUser = createUserFactory();
    const mockPaymentRecord = createPaymentRecordFactory({
      userId: mockUser.id,
      status: 'SUCCEEDED',
      amount: 10000,
    });

    beforeEach(() => {
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
        refunds: [],
      });
    });

    it('should create refund for succeeded payment', async () => {
      // Arrange
      const mockStripeRefund = {
        id: 're_test123',
        status: 'succeeded',
      };

      vi.mocked(stripeService.createRefund).mockResolvedValue(mockStripeRefund);
      vi.mocked(prismaService.refund.create).mockResolvedValue({
        id: 'refund-123',
        paymentId: mockPaymentRecord.id,
        stripeRefundId: 're_test123',
        amount: 10000,
        currency: 'usd',
        status: 'SUCCEEDED',
      });

      // Act
      const result = await paymentsService.createRefund(mockPaymentRecord.id, mockUser.id, {});

      // Assert
      expect(result.refund.amount).toBe(10000);
      expect(stripeService.createRefund).toHaveBeenCalledWith({
        paymentIntentId: mockPaymentRecord.stripePaymentIntentId,
        amount: 10000,
        reason: undefined,
      });
    });

    it('should throw NotFoundException when payment not found', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue(null);

      // Act & Assert
      await expect(
        paymentsService.createRefund('non-existent', 'user-123', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when payment not succeeded', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'PENDING',
        user: mockUser,
        refunds: [],
      });

      // Act & Assert
      await expect(
        paymentsService.createRefund(mockPaymentRecord.id, mockUser.id, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when payment already fully refunded', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
        refunds: [
          { amount: 10000 }, // Already fully refunded
        ],
      });

      // Act & Assert
      await expect(
        paymentsService.createRefund(mockPaymentRecord.id, mockUser.id, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle partial refunds', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
        refunds: [{ amount: 5000 }], // Half already refunded
      });

      const mockStripeRefund = {
        id: 're_test123',
        status: 'succeeded',
      };

      vi.mocked(stripeService.createRefund).mockResolvedValue(mockStripeRefund);
      vi.mocked(prismaService.refund.create).mockResolvedValue({
        id: 'refund-123',
        paymentId: mockPaymentRecord.id,
        stripeRefundId: 're_test123',
        amount: 3000, // $30.00
        currency: 'usd',
        status: 'SUCCEEDED',
      });

      // Act
      const result = await paymentsService.createRefund(mockPaymentRecord.id, mockUser.id, {
        amount: 30, // $30.00
      });

      // Assert
      expect(result.refund.amount).toBe(3000);
      expect(result.remainingRefundable).toBe(2000); // $20.00 remaining
    });

    it('should throw BadRequestException when refund amount exceeds remaining', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
        refunds: [{ amount: 5000 }], // Half already refunded
      });

      // Act & Assert
      await expect(
        paymentsService.createRefund(mockPaymentRecord.id, mockUser.id, {
          amount: 60, // $60.00 exceeds remaining $50.00
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should send refund confirmation email', async () => {
      // Arrange
      const mockStripeRefund = {
        id: 're_test123',
        status: 'succeeded',
      };

      vi.mocked(stripeService.createRefund).mockResolvedValue(mockStripeRefund);
      vi.mocked(prismaService.refund.create).mockResolvedValue({
        id: 'refund-123',
        paymentId: mockPaymentRecord.id,
        stripeRefundId: 're_test123',
        amount: 10000,
        currency: 'usd',
        status: 'SUCCEEDED',
      });

      // Act
      await paymentsService.createRefund(mockPaymentRecord.id, mockUser.id, {});

      // Assert
      expect(mailService.sendRefundConfirmation).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({
          amount: 10000,
          currency: 'usd',
          originalAmount: mockPaymentRecord.amount,
        }),
        mockUser.name || mockUser.email,
      );
    });
  });

  describe('getRefundsForPayment', () => {
    const mockPaymentRecord = createPaymentRecordFactory();
    const mockRefunds = [
      createRefundFactory({ paymentId: mockPaymentRecord.id }),
      createRefundFactory({ paymentId: mockPaymentRecord.id }),
    ];

    it('should return refunds for payment', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        refunds: mockRefunds,
      });

      // Act
      const result = await paymentsService.getRefundsForPayment(
        mockPaymentRecord.id,
        mockPaymentRecord.userId,
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('amount');
      expect(result[0]).toHaveProperty('status');
    });

    it('should throw NotFoundException when payment not found', async () => {
      // Arrange
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue(null);

      // Act & Assert
      await expect(
        paymentsService.getRefundsForPayment('non-existent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserRefunds', () => {
    it('should return all refunds for user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockRefunds = [
        {
          ...createRefundFactory(),
          payment: { id: 'payment-1' },
        },
        {
          ...createRefundFactory(),
          payment: { id: 'payment-2' },
        },
      ];

      vi.mocked(prismaService.refund.findMany).mockResolvedValue(mockRefunds as any);

      // Act
      const result = await paymentsService.getUserRefunds(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(prismaService.refund.findMany).toHaveBeenCalledWith({
        where: {
          payment: {
            userId,
          },
        },
        include: {
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no refunds', async () => {
      // Arrange
      vi.mocked(prismaService.refund.findMany).mockResolvedValue([]);

      // Act
      const result = await paymentsService.getUserRefunds('user-no-refunds');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('Edge Cases - Currency Handling', () => {
    it('should handle EUR currency', async () => {
      // Arrange
      const mockPaymentMethod = { id: 'pm-123', stripePmId: 'pm_stripe123' };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act
      const result = await paymentsService.createPaymentIntent({
        userId: 'user-123',
        stripeCustomerId: 'cus_test123',
        amount: 5000,
        currency: 'eur',
        description: 'EUR payment',
      });

      // Assert
      expect(result.clientSecret).toBe('pi_test123_secret');
      expect(prismaService.paymentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'eur' }),
        }),
      );
    });

    it('should handle GBP currency', async () => {
      // Arrange
      const mockPaymentMethod = { id: 'pm-123', stripePmId: 'pm_stripe123' };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act
      const result = await paymentsService.createPaymentIntent({
        userId: 'user-123',
        stripeCustomerId: 'cus_test123',
        amount: 2500,
        currency: 'gbp',
        description: 'GBP payment',
      });

      // Assert
      expect(result.clientSecret).toBe('pi_test123_secret');
      expect(prismaService.paymentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'gbp' }),
        }),
      );
    });
  });

  describe('Edge Cases - Amount Validation', () => {
    it('should handle minimum amount (1 cent)', async () => {
      // Arrange
      const mockPaymentMethod = { id: 'pm-123', stripePmId: 'pm_stripe123' };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act
      const result = await paymentsService.createPaymentIntent({
        userId: 'user-123',
        stripeCustomerId: 'cus_test123',
        amount: 1,
        currency: 'usd',
        description: 'Minimum amount',
      });

      // Assert
      expect(result.clientSecret).toBe('pi_test123_secret');
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1 }),
      );
    });

    it('should handle large amounts', async () => {
      // Arrange
      const mockPaymentMethod = { id: 'pm-123', stripePmId: 'pm_stripe123' };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act
      const result = await paymentsService.createPaymentIntent({
        userId: 'user-123',
        stripeCustomerId: 'cus_test123',
        amount: 99999999, // $999,999.99
        currency: 'usd',
        description: 'Large amount',
      });

      // Assert
      expect(result.clientSecret).toBe('pi_test123_secret');
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 99999999 }),
      );
    });
  });

  describe('Edge Cases - Tax Calculation', () => {
    it('should handle tax calculation failure gracefully', async () => {
      // Arrange
      vi.mocked(taxService.isTaxEnabled).mockReturnValue(true);
      vi.mocked(taxService.calculateTax).mockRejectedValue(new Error('Tax service unavailable'));

      const mockPaymentMethod = { id: 'pm-123', stripePmId: 'pm_stripe123' };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act - should not throw
      const result = await paymentsService.createPaymentIntent({
        userId: 'user-123',
        stripeCustomerId: 'cus_test123',
        amount: 1000,
        currency: 'usd',
        description: 'Payment with tax failure',
        customerDetails: {
          address: {
            line1: '123 Test St',
            postal_code: '12345',
            country: 'US',
          },
        },
      });

      // Assert - payment should still succeed without tax
      expect(result.taxAmount).toBe(0);
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1000 }),
      );
    });

    it('should include tax details in metadata when tax is calculated', async () => {
      // Arrange
      vi.mocked(taxService.isTaxEnabled).mockReturnValue(true);
      vi.mocked(taxService.calculateTax).mockResolvedValue({
        taxAmount: 200,
        taxRate: 0.2,
        taxDisplayName: 'VAT',
      });

      const mockPaymentMethod = { id: 'pm-123', stripePmId: 'pm_stripe123' };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act
      await paymentsService.createPaymentIntent({
        userId: 'user-123',
        stripeCustomerId: 'cus_test123',
        amount: 1000,
        currency: 'usd',
        description: 'Payment with tax',
      });

      // Assert
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            taxAmount: '200',
            taxRate: '0.2',
          }),
        }),
      );
    });
  });

  describe('Edge Cases - Payment Status Transitions', () => {
    it('should handle canceled payment status', async () => {
      // Arrange
      const mockUser = createUserFactory();
      const mockPaymentRecord = createPaymentRecordFactory({
        userId: mockUser.id,
        stripePaymentIntentId: 'pi_test123',
        status: 'PENDING',
      });

      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
      });

      const mockStripePi = {
        id: 'pi_test123',
        status: 'canceled',
        last_payment_error: null,
      };

      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'CANCELED',
      });

      // Act
      const result = await paymentsService.confirmPayment('pi_test123', mockUser.id);

      // Assert
      expect(result.status).toBe('CANCELED');
    });

    it('should handle requires_action payment status', async () => {
      // Arrange
      const mockUser = createUserFactory();
      const mockPaymentRecord = createPaymentRecordFactory({
        userId: mockUser.id,
        stripePaymentIntentId: 'pi_test123',
        status: 'PENDING',
      });

      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
      });

      const mockStripePi = {
        id: 'pi_test123',
        status: 'requires_action',
        last_payment_error: null,
      };

      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'REQUIRES_ACTION',
      });

      // Act
      const result = await paymentsService.confirmPayment('pi_test123', mockUser.id);

      // Assert
      expect(result.status).toBe('REQUIRES_ACTION');
    });
  });

  describe('Edge Cases - Refund Scenarios', () => {
    it('should handle refund with reason and description', async () => {
      // Arrange
      const mockUser = createUserFactory();
      const mockPaymentRecord = createPaymentRecordFactory({
        userId: mockUser.id,
        status: 'SUCCEEDED',
        amount: 10000,
      });

      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
        refunds: [],
      });

      const mockStripeRefund = {
        id: 're_test123',
        status: 'succeeded',
      };

      vi.mocked(stripeService.createRefund).mockResolvedValue(mockStripeRefund);
      vi.mocked(prismaService.refund.create).mockResolvedValue({
        id: 'refund-123',
        paymentId: mockPaymentRecord.id,
        stripeRefundId: 're_test123',
        amount: 5000,
        currency: 'usd',
        status: 'SUCCEEDED',
        reason: 'requested_by_customer',
        description: 'Customer requested refund',
      });

      // Act
      const result = await paymentsService.createRefund(mockPaymentRecord.id, mockUser.id, {
        amount: 50,
        reason: 'requested_by_customer',
        description: 'Customer requested refund',
      });

      // Assert
      expect(stripeService.createRefund).toHaveBeenCalledWith({
        paymentIntentId: mockPaymentRecord.stripePaymentIntentId,
        amount: 5000,
        reason: 'requested_by_customer',
      });
      // Note: The returned refund object doesn't include reason/description
      // These are stored in the database via prisma.refund.create
      expect(result.refund.id).toBe('refund-123');
      expect(result.refund.amount).toBe(5000);
    });

    it('should handle multiple partial refunds', async () => {
      // Arrange
      const mockUser = createUserFactory();
      const mockPaymentRecord = createPaymentRecordFactory({
        userId: mockUser.id,
        status: 'SUCCEEDED',
        amount: 10000,
      });

      // First refund already exists
      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
        refunds: [
          { amount: 3000 }, // $30.00 already refunded
          { amount: 2000 }, // $20.00 already refunded
        ],
      });

      const mockStripeRefund = {
        id: 're_test123',
        status: 'succeeded',
      };

      vi.mocked(stripeService.createRefund).mockResolvedValue(mockStripeRefund);
      vi.mocked(prismaService.refund.create).mockResolvedValue({
        id: 'refund-123',
        paymentId: mockPaymentRecord.id,
        stripeRefundId: 're_test123',
        amount: 2000,
        currency: 'usd',
        status: 'SUCCEEDED',
      });

      // Act - refund remaining $50.00
      const result = await paymentsService.createRefund(mockPaymentRecord.id, mockUser.id, {
        amount: 20,
      });

      // Assert
      expect(result.refund.amount).toBe(2000);
      expect(result.remainingRefundable).toBe(3000); // $30.00 remaining
    });
  });

  describe('Edge Cases - Error Scenarios', () => {
    it('should handle missing client_secret from Stripe', async () => {
      // Arrange
      const mockPaymentMethod = { id: 'pm-123', stripePmId: 'pm_stripe123' };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: null, // Missing client secret
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockResolvedValue({});
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act & Assert
      await expect(
        paymentsService.createPaymentIntent({
          userId: 'user-123',
          stripeCustomerId: 'cus_test123',
          amount: 1000,
          currency: 'usd',
        }),
      ).rejects.toThrow('Failed to create payment intent');
    });

    it('should handle database error during payment record creation', async () => {
      // Arrange
      const mockPaymentMethod = { id: 'pm-123', stripePmId: 'pm_stripe123' };
      const mockStripePi = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        status: 'requires_confirmation',
      };

      vi.mocked(paymentMethodsService.getDefaultForUser).mockResolvedValue(mockPaymentMethod);
      vi.mocked(stripeService.createPaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.create).mockRejectedValue(new Error('Database error'));
      vi.mocked(redisService.checkIdempotency).mockResolvedValue({ exists: false });

      // Act & Assert
      await expect(
        paymentsService.createPaymentIntent({
          userId: 'user-123',
          stripeCustomerId: 'cus_test123',
          amount: 1000,
          currency: 'usd',
        }),
      ).rejects.toThrow('Database error');
    });

    it('should handle Stripe refund failure', async () => {
      // Arrange
      const mockUser = createUserFactory();
      const mockPaymentRecord = createPaymentRecordFactory({
        userId: mockUser.id,
        status: 'SUCCEEDED',
        amount: 10000,
      });

      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
        refunds: [],
      });

      vi.mocked(stripeService.createRefund).mockRejectedValue(new Error('Refund failed'));

      // Act & Assert
      await expect(
        paymentsService.createRefund(mockPaymentRecord.id, mockUser.id, {}),
      ).rejects.toThrow('Refund failed');
    });
  });

  describe('Edge Cases - User Data', () => {
    it('should handle user without name in email', async () => {
      // Arrange
      const mockUser = createUserFactory({ name: '' });
      const mockPaymentRecord = createPaymentRecordFactory({
        userId: mockUser.id,
        stripePaymentIntentId: 'pi_test123',
        status: 'PENDING',
      });

      vi.mocked(prismaService.paymentRecord.findFirst).mockResolvedValue({
        ...mockPaymentRecord,
        user: mockUser,
      });

      const mockStripePi = {
        id: 'pi_test123',
        status: 'succeeded',
        last_payment_error: null,
      };

      vi.mocked(stripeService.retrievePaymentIntent).mockResolvedValue(mockStripePi);
      vi.mocked(prismaService.paymentRecord.update).mockResolvedValue({
        ...mockPaymentRecord,
        status: 'SUCCEEDED',
      });

      // Act
      await paymentsService.confirmPayment('pi_test123', mockUser.id);

      // Assert - should use email when name is not available
      expect(mailService.sendPaymentReceipt).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(Object),
        mockUser.email, // Falls back to email when name is undefined
      );
    });
  });
});
