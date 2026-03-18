import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { CacheService } from '../cache/cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SuspendUserDto, UnsuspendUserDto } from './dto/suspend-user.dto';
import { UserEntity } from './entities/user.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly cacheService: CacheService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create Stripe customer first (DB is source of truth, but we need stripeCustomerId)
    let stripeCustomer: Stripe.Customer;
    try {
      stripeCustomer = await this.stripeService.createCustomer(
        createUserDto.email,
        createUserDto.name,
      );
    } catch (error) {
      // Handle Stripe-specific errors
      if (error instanceof Stripe.errors.StripeError) {
        this.logger.error('Stripe customer creation failed', {
          email: createUserDto.email,
          errorType: error.type,
          errorCode: error.code,
          message: error.message,
        });

        // Determine user-friendly error message
        const isDev = process.env.NODE_ENV !== 'production';
        const errorMessage = isDev
          ? `Payment setup failed: ${error.message}`
          : 'Payment setup failed. Please try again or contact support.';

        throw new InternalServerErrorException(errorMessage, {
          cause: error,
          description: isDev
            ? `Stripe error: ${error.type}${error.code ? ` (${error.code})` : ''}`
            : undefined,
        });
      }
      throw error;
    }

    // Create user in DB with stripeCustomerId
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        name: createUserDto.name,
        country: createUserDto.country,
        stripeCustomerId: stripeCustomer.id,
      },
    });

    return this.toEntity(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    // Try cache first (using email as part of key since we don't have ID yet)
    const cacheKey = `user:email:${email}`;
    const cached = await this.cacheService.get<UserEntity>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const entity = this.toEntity(user);
      // Cache for 5 minutes (300 seconds)
      await this.cacheService.set(cacheKey, entity, { ttlSeconds: 300 });
      // Also cache by ID for consistency
      await this.cacheService.set(
        this.cacheService.userKey(user.id),
        entity,
        { ttlSeconds: 300 },
      );
      return entity;
    }

    return null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    // Try cache first
    const cached = await this.cacheService.get<UserEntity>(
      this.cacheService.userKey(id),
    );
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (user) {
      const entity = this.toEntity(user);
      // Cache for 5 minutes (300 seconds)
      await this.cacheService.set(this.cacheService.userKey(id), entity, { ttlSeconds: 300 });
      return entity;
    }

    return null;
  }

  async updateDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string | null,
  ): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { defaultPaymentMethodId: paymentMethodId },
    });

    return this.toEntity(user);
  }

  async validatePassword(
    user: UserEntity,
    password: string,
  ): Promise<boolean> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });

    if (!dbUser) return false;

    return bcrypt.compare(password, dbUser.password);
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async updatePreferredCurrency(
    userId: string,
    currency: string,
  ): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { preferredCurrency: currency.toLowerCase() },
    });

    return this.toEntity(user);
  }

  async updateCountry(userId: string, country: string): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { country },
    });

    return this.toEntity(user);
  }

  // ==================== USER SUSPENSION ====================

  async suspendUser(userId: string, dto: SuspendUserDto): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const suspensionExpiry = dto.duration
      ? new Date(Date.now() + dto.duration * 24 * 60 * 60 * 1000)
      : null;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        suspended: true,
        suspendedAt: new Date(),
        suspensionReason: dto.reason,
        suspensionExpiry,
      },
    });

    return this.toEntity(updatedUser);
  }

  async unsuspendUser(userId: string, dto: UnsuspendUserDto): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        suspended: false,
        suspendedAt: null,
        suspensionReason: null,
        suspensionExpiry: null,
      },
    });

    return this.toEntity(updatedUser);
  }

  async isUserSuspended(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        suspended: true,
        suspensionExpiry: true,
      },
    });

    if (!user || !user.suspended) {
      return false;
    }

    // Check if suspension has expired
    if (user.suspensionExpiry && user.suspensionExpiry < new Date()) {
      // Auto-unsuspend
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          suspended: false,
          suspendedAt: null,
          suspensionReason: null,
          suspensionExpiry: null,
        },
      });
      return false;
    }

    return true;
  }

  async getSuspendedUsers(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: {
        suspended: true,
      },
      orderBy: { suspendedAt: 'desc' },
    });

    return users.map((user) => this.toEntity(user));
  }

  private toEntity(user: any): UserEntity {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      preferredCurrency: user.preferredCurrency || 'usd',
      country: user.country,
      stripeCustomerId: user.stripeCustomerId,
      defaultPaymentMethodId: user.defaultPaymentMethodId,
      suspended: user.suspended,
      suspendedAt: user.suspendedAt,
      suspensionReason: user.suspensionReason,
      suspensionExpiry: user.suspensionExpiry,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
