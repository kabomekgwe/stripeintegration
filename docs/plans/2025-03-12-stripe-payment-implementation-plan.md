# Stripe Payment System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete Stripe-integrated payment system with Next.js frontend, NestJS backend, PostgreSQL, Redis, and Docker - featuring embedded payments, usage-based billing, and DB-first architecture.

**Architecture:** Database is source of truth with Stripe as mirror; Redis for sessions, rate limiting, and idempotency; Docker Compose for all services; embedded Stripe Payment Element for no-redirect payments.

**Tech Stack:** NestJS + Prisma + PostgreSQL + Redis + Next.js + Stripe.js + Docker

---

## Phase 1: Infrastructure & Database Setup

### Task 1: Root Docker Compose Configuration

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env`

**Step 1: Write docker-compose.yml**

```yaml
version: '3.8'

networks:
  stripe-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24

services:
  postgres:
    image: postgres:16-alpine
    container_name: stripe-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: stripe
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      stripe-network:
        ipv4_address: 172.20.0.2
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: stripe-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass redis
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      stripe-network:
        ipv4_address: 172.20.0.3
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: stripe-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:postgres@172.20.0.2:5432/stripe
      REDIS_URL: redis://:redis@172.20.0.3:6379
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      stripe-network:
        ipv4_address: 172.20.0.4
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: stripe-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: http://localhost:3001
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      stripe-network:
        ipv4_address: 172.20.0.5

volumes:
  postgres_data:
  redis_data:
```

**Step 2: Write .env.example**

```
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stripe

# Redis
REDIS_URL=redis://:redis@localhost:6379

# Stripe (replace with your keys from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# App
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

**Step 3: Copy .env.example to .env**

```bash
cp .env.example .env
```

**Step 4: Commit**

```bash
git add docker-compose.yml .env.example .env
git commit -m "infra: add docker compose with postgres, redis, and app services"
```

---

### Task 2: Backend Dependencies & Prisma Setup

**Files:**
- Modify: `backend/package.json`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/.env`

**Step 1: Add dependencies to backend/package.json**

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/config": "^4.0.0",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/schedule": "^5.0.1",
    "@prisma/client": "^6.5.0",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "ioredis": "^5.5.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "stripe": "^17.7.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@eslint/js": "^9.18.0",
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^22.10.7",
    "@types/passport-jwt": "^4.0.1",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-prettier": "^5.2.2",
    "globals": "^16.0.0",
    "jest": "^30.0.0",
    "prettier": "^3.4.2",
    "prisma": "^6.5.0",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0"
  }
}
```

**Step 2: Install dependencies**

```bash
cd backend && pnpm install
```

**Step 3: Create Prisma schema**

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                    String          @id @default(cuid())
  email                 String          @unique
  password              String
  name                  String?
  stripeCustomerId      String?         @unique
  defaultPaymentMethodId String?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  
  paymentMethods        PaymentMethod[]
  payments              PaymentRecord[]
  usageRecords          UsageRecord[]

  @@map("users")
}

model PaymentMethod {
  id            String    @id @default(cuid())
  userId        String
  stripePmId    String    @unique
  type          String    // card, sepa_debit, us_bank_account
  brand         String?   // visa, mastercard, amex
  last4         String?
  expMonth      Int?
  expYear       Int?
  isDefault     Boolean   @default(false)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("payment_methods")
}

model PaymentRecord {
  id                      String        @id @default(cuid())
  userId                  String
  stripePaymentIntentId   String        @unique
  amount                  Int           // cents
  currency                String        @default("usd")
  status                  PaymentStatus @default(PENDING)
  paymentMethodId         String?
  description             String?
  metadata                Json?
  errorMessage            String?
  createdAt               DateTime      @default(now())
  updatedAt               DateTime      @updatedAt
  
  user                    User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("payment_records")
}

model UsageRecord {
  id            String    @id @default(cuid())
  userId        String
  period        String    // "2026-02" YYYY-MM format
  amount        Int       // Total amount to bill (cents)
  usageCount    Int       // Raw usage count
  description   String?   // e.g., "API calls: 1200"
  billed        Boolean   @default(false)
  paymentId     String?   // Links to PaymentRecord after billing
  createdAt     DateTime  @default(now())
  
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, period])
  @@index([userId])
  @@index([billed])
  @@index([period])
  @@map("usage_records")
}

model WebhookEvent {
  id            String    @id @default(cuid())
  stripeEventId String    @unique
  type          String
  data          Json
  processed     Boolean   @default(false)
  processedAt   DateTime?
  error         String?
  createdAt     DateTime  @default(now())
  
  @@index([processed])
  @@index([type])
  @@map("webhook_events")
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELED
  REQUIRES_ACTION

  @@map("payment_status")
}
```

**Step 4: Create backend .env**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stripe
REDIS_URL=redis://:redis@localhost:6379
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
JWT_SECRET=your-jwt-secret-min-32-characters-long
PORT=3001
NODE_ENV=development
```

**Step 5: Generate Prisma client**

```bash
cd backend && npx prisma generate
```

**Step 6: Commit**

```bash
git add backend/package.json backend/prisma/schema.prisma backend/.env
git commit -m "setup: add prisma schema and backend dependencies"
```

---

### Task 3: Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

**Step 1: Write Dockerfile**

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy prisma schema first for generation
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN pnpm build

EXPOSE 3001

CMD ["pnpm", "start:prod"]
```

**Step 2: Write .dockerignore**

```
node_modules
dist
.git
.env
.env.local
.env.*.local
*.log
npm-debug.log*
.DS_Store
.vscode
.idea
coverage
.nyc_output
```

**Step 3: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "infra: add backend Dockerfile"
```

---

## Phase 2: Backend Core Services

### Task 4: Redis Service Module

**Files:**
- Create: `backend/src/redis/redis.module.ts`
- Create: `backend/src/redis/redis.service.ts`

**Step 1: Create Redis module**

```typescript
// backend/src/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        return new Redis(redisUrl);
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
```

**Step 2: Create Redis service**

```typescript
// backend/src/redis/redis.service.ts
import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // Rate limiting
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const currentCount = results?.[1]?.[1] as number;

    if (currentCount >= limit) {
      // Remove the entry we just added since we're over limit
      await this.redis.zpopmax(key, 1);
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + windowSeconds,
      };
    }

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetTime: now + windowSeconds,
    };
  }

  // Idempotency keys
  async checkIdempotency(
    key: string,
  ): Promise<{ exists: boolean; response?: any }> {
    const stored = await this.redis.get(`idempotency:${key}`);
    if (stored) {
      return { exists: true, response: JSON.parse(stored) };
    }
    return { exists: false };
  }

  async setIdempotency(
    key: string,
    response: any,
    ttlHours: number = 24,
  ): Promise<void> {
    await this.redis.setex(
      `idempotency:${key}`,
      ttlHours * 3600,
      JSON.stringify(response),
    );
  }

  // Session management
  async setSession(
    token: string,
    userId: string,
    ttlHours: number = 24,
  ): Promise<void> {
    await this.redis.setex(`session:${token}`, ttlHours * 3600, userId);
  }

  async getSession(token: string): Promise<string | null> {
    return this.redis.get(`session:${token}`);
  }

  async deleteSession(token: string): Promise<void> {
    await this.redis.del(`session:${token}`);
  }

  // Webhook processing lock
  async acquireWebhookLock(
    eventId: string,
    ttlSeconds: number = 300,
  ): Promise<boolean> {
    const key = `webhook_lock:${eventId}`;
    const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseWebhookLock(eventId: string): Promise<void> {
    await this.redis.del(`webhook_lock:${eventId}`);
  }

  // Payment intent cache
  async cachePaymentIntent(
    paymentIntentId: string,
    data: any,
    ttlMinutes: number = 5,
  ): Promise<void> {
    await this.redis.setex(
      `pi:${paymentIntentId}`,
      ttlMinutes * 60,
      JSON.stringify(data),
    );
  }

  async getCachedPaymentIntent(paymentIntentId: string): Promise<any | null> {
    const data = await this.redis.get(`pi:${paymentIntentId}`);
    return data ? JSON.parse(data) : null;
  }

  // Retry counter for failed payments
  async incrementRetryCounter(paymentIntentId: string): Promise<number> {
    const key = `retry:${paymentIntentId}`;
    const count = await this.redis.incr(key);
    await this.redis.expire(key, 24 * 3600); // 24 hour TTL
    return count;
  }

  async getRetryCount(paymentIntentId: string): Promise<number> {
    const count = await this.redis.get(`retry:${paymentIntentId}`);
    return count ? parseInt(count, 10) : 0;
  }

  // General cache operations
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
```

**Step 3: Commit**

```bash
git add backend/src/redis/
git commit -m "feat: add Redis service with rate limiting, idempotency, and session management"
```

---

### Task 5: Database Module

**Files:**
- Create: `backend/src/database/database.module.ts`
- Create: `backend/src/database/prisma.service.ts`

**Step 1: Create database module**

```typescript
// backend/src/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

**Step 2: Create Prisma service**

```typescript
// backend/src/database/prisma.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }
}
```

**Step 3: Commit**

```bash
git add backend/src/database/
git commit -m "feat: add Prisma database service"
```

---

### Task 6: Stripe Service Module

**Files:**
- Create: `backend/src/stripe/stripe.module.ts`
- Create: `backend/src/stripe/stripe.service.ts`

**Step 1: Create Stripe module**

```typescript
// backend/src/stripe/stripe.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripeService } from './stripe.service';

@Module({
  imports: [ConfigModule],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
```

**Step 2: Create Stripe service**

```typescript
// backend/src/stripe/stripe.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  // Customer management
  async createCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Customer> {
    const idempotencyKey = uuidv4();

    return this.stripe.customers.create(
      {
        email,
        name,
        metadata,
      },
      { idempotencyKey },
    );
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<Stripe.CustomerUpdateParams>,
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.update(customerId, updates);
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await this.stripe.customers.del(customerId);
  }

  // Payment methods
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async listPaymentMethods(
    customerId: string,
    type?: Stripe.PaymentMethodListParams.Type,
  ): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    return this.stripe.paymentMethods.list({
      customer: customerId,
      type: type || 'card',
    });
  }

  // Setup intents (for saving payment methods)
  async createSetupIntent(
    customerId: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.SetupIntent> {
    const idempotencyKey = uuidv4();

    return this.stripe.setupIntents.create(
      {
        customer: customerId,
        payment_method_types: ['card', 'sepa_debit'],
        metadata,
        usage: 'off_session',
      },
      { idempotencyKey },
    );
  }

  // Payment intents (for immediate charges)
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    customerId: string;
    paymentMethodId?: string;
    offSession?: boolean;
    confirm?: boolean;
    description?: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<Stripe.PaymentIntent> {
    const idempotencyKey = params.idempotencyKey || uuidv4();

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: params.amount,
      currency: params.currency,
      customer: params.customerId,
      description: params.description,
      metadata: params.metadata,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    };

    if (params.paymentMethodId) {
      paymentIntentParams.payment_method = params.paymentMethodId;
    }

    if (params.offSession) {
      paymentIntentParams.off_session = true;
    }

    if (params.confirm) {
      paymentIntentParams.confirm = true;
    }

    return this.stripe.paymentIntents.create(paymentIntentParams, {
      idempotencyKey,
    });
  }

  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<Stripe.PaymentIntent> {
    const params: Stripe.PaymentIntentConfirmParams = {};
    if (paymentMethodId) {
      params.payment_method = paymentMethodId;
    }
    return this.stripe.paymentIntents.confirm(paymentIntentId, params);
  }

  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  // Webhooks
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  // Test clocks (for testing)
  async createTestClock(frozenTime: number): Promise<Stripe.TestHelpers.TestClock> {
    return this.stripe.testHelpers.testClocks.create({
      frozen_time: frozenTime,
    });
  }

  async advanceTestClock(
    testClockId: string,
    frozenTime: number,
  ): Promise<Stripe.TestHelpers.TestClock> {
    return this.stripe.testHelpers.testClocks.advance(testClockId, {
      frozen_time: frozenTime,
    });
  }
}
```

**Step 3: Commit**

```bash
git add backend/src/stripe/
git commit -m "feat: add Stripe service with customers, payment methods, and payment intents"
```

---

## Phase 3: Backend Domain Modules

### Task 7: Users Module

**Files:**
- Create: `backend/src/users/users.module.ts`
- Create: `backend/src/users/users.service.ts`
- Create: `backend/src/users/dto/create-user.dto.ts`
- Create: `backend/src/users/entities/user.entity.ts`

**Step 1: Create DTO**

```typescript
// backend/src/users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}
```

**Step 2: Create entity**

```typescript
// backend/src/users/entities/user.entity.ts
export class UserEntity {
  id: string;
  email: string;
  name?: string;
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Step 3: Create service**

```typescript
// backend/src/users/users.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
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
    const stripeCustomer = await this.stripeService.createCustomer(
      createUserDto.email,
      createUserDto.name,
    );

    // Create user in DB with stripeCustomerId
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        name: createUserDto.name,
        stripeCustomerId: stripeCustomer.id,
      },
    });

    return this.toEntity(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user ? this.toEntity(user) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    return user ? this.toEntity(user) : null;
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

  private toEntity(user: any): UserEntity {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      stripeCustomerId: user.stripeCustomerId,
      defaultPaymentMethodId: user.defaultPaymentMethodId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
```

**Step 4: Create module**

```typescript
// backend/src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [StripeModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

**Step 5: Commit**

```bash
git add backend/src/users/
git commit -m "feat: add users module with Stripe customer creation"
```

---

### Task 8: Auth Module

**Files:**
- Create: `backend/src/auth/auth.module.ts`
- Create: `backend/src/auth/auth.service.ts`
- Create: `backend/src/auth/auth.controller.ts`
- Create: `backend/src/auth/guards/jwt-auth.guard.ts`
- Create: `backend/src/auth/strategies/jwt.strategy.ts`
- Create: `backend/src/auth/dto/login.dto.ts`
- Create: `backend/src/auth/dto/register.dto.ts`

**Step 1: Create DTOs**

```typescript
// backend/src/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

```typescript
// backend/src/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}
```

**Step 2: Create JWT strategy**

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
```

**Step 3: Create JWT guard**

```typescript
// backend/src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Step 4: Create auth service**

```typescript
// backend/src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserEntity } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: UserEntity; accessToken: string }> {
    try {
      const user = await this.usersService.create({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
      });

      const accessToken = await this.generateToken(user);
      await this.redisService.setSession(accessToken, user.id);

      return { user, accessToken };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Registration failed');
    }
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: UserEntity; accessToken: string }> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      user,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.generateToken(user);
    await this.redisService.setSession(accessToken, user.id);

    return { user, accessToken };
  }

  async logout(token: string): Promise<void> {
    await this.redisService.deleteSession(token);
  }

  async validateToken(token: string): Promise<UserEntity | null> {
    const userId = await this.redisService.getSession(token);
    if (!userId) return null;

    return this.usersService.findById(userId);
  }

  private async generateToken(user: UserEntity): Promise<string> {
    const payload = { sub: user.id, email: user.email };
    return this.jwtService.signAsync(payload);
  }
}
```

**Step 5: Create auth controller**

```typescript
// backend/src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        stripeCustomerId: result.user.stripeCustomerId,
      },
      accessToken: result.accessToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        stripeCustomerId: result.user.stripeCustomerId,
      },
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Headers('authorization') auth: string) {
    const token = auth.replace('Bearer ', '');
    await this.authService.logout(token);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const user = req.user;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      stripeCustomerId: user.stripeCustomerId,
      defaultPaymentMethodId: user.defaultPaymentMethodId,
    };
  }
}
```

**Step 6: Create auth module**

```typescript
// backend/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

**Step 7: Commit**

```bash
git add backend/src/auth/
git commit -m "feat: add auth module with JWT, login, register, and logout"
```

---

### Task 9: Payment Methods Module

**Files:**
- Create: `backend/src/payment-methods/payment-methods.module.ts`
- Create: `backend/src/payment-methods/payment-methods.service.ts`
- Create: `backend/src/payment-methods/payment-methods.controller.ts`
- Create: `backend/src/payment-methods/dto/setup-intent.dto.ts`
- Create: `backend/src/payment-methods/entities/payment-method.entity.ts`

**Step 1: Create DTO**

```typescript
// backend/src/payment-methods/dto/setup-intent.dto.ts
export class SetupIntentResponseDto {
  clientSecret: string;
}
```

**Step 2: Create entity**

```typescript
// backend/src/payment-methods/entities/payment-method.entity.ts
export class PaymentMethodEntity {
  id: string;
  stripePmId: string;
  type: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}
```

**Step 3: Create service**

```typescript
// backend/src/payment-methods/payment-methods.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodEntity } from './entities/payment-method.entity';
import Stripe from 'stripe';

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
```

**Step 4: Create controller**

```typescript
// backend/src/payment-methods/payment-methods.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  async findAll(@Request() req) {
    const methods = await this.paymentMethodsService.findByUser(req.user.id);
    return { paymentMethods: methods };
  }

  @Post('setup-intent')
  async createSetupIntent(@Request() req) {
    const result = await this.paymentMethodsService.createSetupIntent(
      req.user.id,
      req.user.stripeCustomerId,
    );
    return result;
  }

  @Post('save')
  @HttpCode(HttpStatus.CREATED)
  async savePaymentMethod(
    @Request() req,
    @Body('paymentMethodId') paymentMethodId: string,
  ) {
    const method = await this.paymentMethodsService.savePaymentMethod(
      req.user.id,
      paymentMethodId,
      req.user.stripeCustomerId,
    );
    return { paymentMethod: method };
  }

  @Post(':id/default')
  async setDefault(@Request() req, @Param('id') id: string) {
    const method = await this.paymentMethodsService.setDefault(req.user.id, id);
    return { paymentMethod: method };
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    const method = await this.paymentMethodsService.remove(req.user.id, id);
    return { paymentMethod: method };
  }
}
```

**Step 5: Create module**

```typescript
// backend/src/payment-methods/payment-methods.module.ts
import { Module } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [StripeModule],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
```

**Step 6: Commit**

```bash
git add backend/src/payment-methods/
git commit -m "feat: add payment methods module with setup intents and default management"
```

---

### Task 10: Payments Module (Immediate Payments)

**Files:**
- Create: `backend/src/payments/payments.module.ts`
- Create: `backend/src/payments/payments.service.ts`
- Create: `backend/src/payments/payments.controller.ts`
- Create: `backend/src/payments/dto/create-payment.dto.ts`
- Create: `backend/src/payments/entities/payment.entity.ts`
- Create: `backend/src/payments/guards/rate-limit.guard.ts`

**Step 1: Create DTO**

```typescript
// backend/src/payments/dto/create-payment.dto.ts
import { IsInt, IsString, IsOptional, Min, IsIn } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @Min(50) // Minimum 50 cents
  amount: number; // in cents

  @IsString()
  @IsIn(['usd', 'eur', 'gbp'])
  currency: string = 'usd';

  @IsOptional()
  @IsString()
  paymentMethodId?: string; // If not provided, uses default

  @IsOptional()
  @IsString()
  description?: string;
}
```

**Step 2: Create entity**

```typescript
// backend/src/payments/entities/payment.entity.ts
export class PaymentEntity {
  id: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethodId?: string;
  description?: string;
  errorMessage?: string;
  createdAt: Date;
}
```

**Step 3: Create rate limit guard**

```typescript
// backend/src/payments/guards/rate-limit.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class PaymentRateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      return true;
    }

    const key = `rate_limit:payment:${userId}`;
    const result = await this.redisService.checkRateLimit(key, 10, 60); // 10 per minute

    if (!result.allowed) {
      throw new HttpException(
        {
          message: 'Rate limit exceeded. Please try again later.',
          resetTime: result.resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
```

**Step 4: Create service**

```typescript
// backend/src/payments/payments.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { RedisService } from '../redis/redis.service';
import { PaymentEntity } from './entities/payment.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly redisService: RedisService,
  ) {}

  async createPaymentIntent(params: {
    userId: string;
    stripeCustomerId: string;
    amount: number;
    currency: string;
    paymentMethodId?: string;
    description?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    // Determine payment method
    let paymentMethodStripeId: string | undefined;

    if (params.paymentMethodId) {
      // User specified a payment method
      const pm = await this.prisma.paymentMethod.findFirst({
        where: {
          id: params.paymentMethodId,
          userId: params.userId,
          isActive: true,
        },
      });
      if (!pm) {
        throw new NotFoundException('Payment method not found');
      }
      paymentMethodStripeId = pm.stripePmId;
    } else {
      // Use default
      const defaultPm = await this.paymentMethodsService.getDefaultForUser(
        params.userId,
      );
      if (!defaultPm) {
        throw new BadRequestException(
          'No default payment method found. Please add a payment method first.',
        );
      }
      paymentMethodStripeId = defaultPm.stripePmId;
    }

    // Check idempotency
    const idempotencyKey = uuidv4();
    const cached = await this.redisService.checkIdempotency(idempotencyKey);
    if (cached.exists) {
      return cached.response;
    }

    // Create payment intent in Stripe
    const stripePi = await this.stripeService.createPaymentIntent({
      amount: params.amount,
      currency: params.currency,
      customerId: params.stripeCustomerId,
      paymentMethodId: paymentMethodStripeId,
      description: params.description,
      metadata: {
        userId: params.userId,
        internalPaymentId: idempotencyKey,
      },
      idempotencyKey,
    });

    // Create record in database
    await this.prisma.paymentRecord.create({
      data: {
        userId: params.userId,
        stripePaymentIntentId: stripePi.id,
        amount: params.amount,
        currency: params.currency,
        status: stripePi.status.toUpperCase(),
        paymentMethodId: params.paymentMethodId,
        description: params.description,
        metadata: stripePi.metadata,
      },
    });

    const result = {
      clientSecret: stripePi.client_secret,
      paymentIntentId: stripePi.id,
    };

    // Cache for idempotency
    await this.redisService.setIdempotency(idempotencyKey, result);

    return result;
  }

  async confirmPayment(
    paymentIntentId: string,
    userId: string,
  ): Promise<PaymentEntity> {
    // Verify ownership
    const record = await this.prisma.paymentRecord.findFirst({
      where: { stripePaymentIntentId: paymentIntentId, userId },
    });

    if (!record) {
      throw new NotFoundException('Payment not found');
    }

    // Retrieve from Stripe to get latest status
    const stripePi = await this.stripeService.retrievePaymentIntent(
      paymentIntentId,
    );

    // Update database
    const updated = await this.prisma.paymentRecord.update({
      where: { id: record.id },
      data: {
        status: stripePi.status.toUpperCase(),
        errorMessage:
          stripePi.last_payment_error?.message ||
          stripePi.last_setup_error?.message,
      },
    });

    return this.toEntity(updated);
  }

  async findByUser(userId: string): Promise<PaymentEntity[]> {
    const payments = await this.prisma.paymentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => this.toEntity(p));
  }

  async findById(id: string, userId: string): Promise<PaymentEntity | null> {
    const payment = await this.prisma.paymentRecord.findFirst({
      where: { id, userId },
    });

    return payment ? this.toEntity(payment) : null;
  }

  async retryPayment(
    paymentId: string,
    userId: string,
  ): Promise<PaymentEntity> {
    const record = await this.prisma.paymentRecord.findFirst({
      where: { id: paymentId, userId },
    });

    if (!record) {
      throw new NotFoundException('Payment not found');
    }

    // Check retry count
    const retryCount = await this.redisService.getRetryCount(
      record.stripePaymentIntentId,
    );
    if (retryCount >= 3) {
      throw new BadRequestException(
        'Maximum retry attempts reached. Please create a new payment.',
      );
    }

    // Increment retry counter
    await this.redisService.incrementRetryCounter(
      record.stripePaymentIntentId,
    );

    // Try to confirm again
    try {
      await this.stripeService.confirmPaymentIntent(
        record.stripePaymentIntentId,
      );
    } catch (error) {
      // Update with error
      await this.prisma.paymentRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });
      throw error;
    }

    // Get updated status
    return this.confirmPayment(record.stripePaymentIntentId, userId);
  }

  private toEntity(payment: any): PaymentEntity {
    return {
      id: payment.id,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethodId: payment.paymentMethodId,
      description: payment.description,
      errorMessage: payment.errorMessage,
      createdAt: payment.createdAt,
    };
  }
}
```

**Step 5: Create controller**

```typescript
// backend/src/payments/payments.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentRateLimitGuard } from './guards/rate-limit.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(PaymentRateLimitGuard)
  async createPaymentIntent(
    @Request() req,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    const result = await this.paymentsService.createPaymentIntent({
      userId: req.user.id,
      stripeCustomerId: req.user.stripeCustomerId,
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      paymentMethodId: createPaymentDto.paymentMethodId,
      description: createPaymentDto.description,
    });

    return result;
  }

  @Post(':id/confirm')
  async confirmPayment(@Request() req, @Param('id') id: string) {
    const payment = await this.paymentsService.confirmPayment(id, req.user.id);
    return { payment };
  }

  @Get()
  async findAll(@Request() req) {
    const payments = await this.paymentsService.findByUser(req.user.id);
    return { payments };
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    const payment = await this.paymentsService.findById(id, req.user.id);
    if (!payment) {
      return { payment: null };
    }
    return { payment };
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retryPayment(@Request() req, @Param('id') id: string) {
    const payment = await this.paymentsService.retryPayment(id, req.user.id);
    return { payment };
  }
}
```

**Step 6: Create module**

```typescript
// backend/src/payments/payments.module.ts
import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StripeModule } from '../stripe/stripe.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';

@Module({
  imports: [StripeModule, PaymentMethodsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
```

**Step 7: Commit**

```bash
git add backend/src/payments/
git commit -m "feat: add payments module with rate limiting and idempotency"
```

---

### Task 11: Usage & Billing Module

**Files:**
- Create: `backend/src/usage/usage.module.ts`
- Create: `backend/src/usage/usage.service.ts`
- Create: `backend/src/usage/usage.controller.ts`
- Create: `backend/src/usage/dto/create-usage.dto.ts`
- Create: `backend/src/usage/dto/billing-preview.dto.ts`
- Create: `backend/src/usage/entities/usage.entity.ts`

**Step 1: Create DTOs**

```typescript
// backend/src/usage/dto/create-usage.dto.ts
import { IsInt, IsString, IsOptional, Min } from 'class-validator';

export class CreateUsageDto {
  @IsInt()
  @Min(0)
  amount: number; // Amount to bill in cents

  @IsInt()
  @Min(0)
  usageCount: number; // Raw usage metric

  @IsOptional()
  @IsString()
  description?: string;
}
```

```typescript
// backend/src/usage/dto/billing-preview.dto.ts
export class BillingPreviewDto {
  period: string;
  totalAmount: number;
  usageCount: number;
  description: string;
}
```

**Step 2: Create entity**

```typescript
// backend/src/usage/entities/usage.entity.ts
export class UsageEntity {
  id: string;
  period: string;
  amount: number;
  usageCount: number;
  description?: string;
  billed: boolean;
  paymentId?: string;
  createdAt: Date;
}
```

**Step 3: Create service**

```typescript
// backend/src/usage/usage.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { RedisService } from '../redis/redis.service';
import { UsageEntity } from './entities/usage.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly redisService: RedisService,
  ) {}

  async recordUsage(params: {
    userId: string;
    amount: number;
    usageCount: number;
    description?: string;
  }): Promise<UsageEntity> {
    const period = this.getCurrentPeriod();

    const usage = await this.prisma.usageRecord.upsert({
      where: {
        userId_period: {
          userId: params.userId,
          period,
        },
      },
      update: {
        amount: { increment: params.amount },
        usageCount: { increment: params.usageCount },
        description: params.description,
      },
      create: {
        userId: params.userId,
        period,
        amount: params.amount,
        usageCount: params.usageCount,
        description: params.description,
      },
    });

    return this.toEntity(usage);
  }

  async findByUser(userId: string): Promise<UsageEntity[]> {
    const records = await this.prisma.usageRecord.findMany({
      where: { userId },
      orderBy: { period: 'desc' },
    });

    return records.map((r) => this.toEntity(r));
  }

  async previewNextBill(userId: string): Promise<{
    period: string;
    totalAmount: number;
    usageCount: number;
    description: string;
  } | null> {
    const period = this.getCurrentPeriod();

    const record = await this.prisma.usageRecord.findUnique({
      where: {
        userId_period: {
          userId,
          period,
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      period: record.period,
      totalAmount: record.amount,
      usageCount: record.usageCount,
      description: record.description || `Usage for ${record.period}`,
    };
  }

  async generateMonthlyBilling(params: {
    userId: string;
    stripeCustomerId: string;
    period?: string;
  }): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    const period = params.period || this.getPreviousPeriod();

    // Get unbilled usage
    const usage = await this.prisma.usageRecord.findUnique({
      where: {
        userId_period: {
          userId: params.userId,
          period,
        },
      },
    });

    if (!usage || usage.billed || usage.amount === 0) {
      return { success: true }; // Nothing to bill
    }

    // Get default payment method
    const defaultPm = await this.paymentMethodsService.getDefaultForUser(
      params.userId,
    );

    if (!defaultPm) {
      this.logger.warn(`No default payment method for user ${params.userId}`);
      return {
        success: false,
        error: 'No default payment method found',
      };
    }

    // Create idempotency key
    const idempotencyKey = `billing:${params.userId}:${period}:${uuidv4()}`;

    try {
      // Create off-session payment intent
      const stripePi = await this.stripeService.createPaymentIntent({
        amount: usage.amount,
        currency: 'usd',
        customerId: params.stripeCustomerId,
        paymentMethodId: defaultPm.stripePmId,
        offSession: true,
        confirm: true,
        description: `Monthly usage billing for ${period}`,
        metadata: {
          userId: params.userId,
          period,
          usageId: usage.id,
          usageCount: usage.usageCount.toString(),
        },
        idempotencyKey,
      });

      // Create payment record
      const payment = await this.prisma.paymentRecord.create({
        data: {
          userId: params.userId,
          stripePaymentIntentId: stripePi.id,
          amount: usage.amount,
          currency: 'usd',
          status: stripePi.status.toUpperCase(),
          paymentMethodId: defaultPm.id,
          description: `Monthly usage billing for ${period}`,
          metadata: stripePi.metadata,
        },
      });

      // Mark usage as billed
      await this.prisma.usageRecord.update({
        where: { id: usage.id },
        data: {
          billed: true,
          paymentId: payment.id,
        },
      });

      this.logger.log(
        `Billed user ${params.userId} $${usage.amount / 100} for ${period}`,
      );

      return {
        success: stripePi.status === 'succeeded',
        paymentId: payment.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to bill user ${params.userId} for ${period}: ${error.message}`,
      );

      // Create failed payment record
      await this.prisma.paymentRecord.create({
        data: {
          userId: params.userId,
          stripePaymentIntentId: `failed_${uuidv4()}`,
          amount: usage.amount,
          currency: 'usd',
          status: 'FAILED',
          paymentMethodId: defaultPm.id,
          description: `Monthly usage billing for ${period}`,
          errorMessage: error.message,
        },
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async generateAllMonthlyBilling(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const period = this.getPreviousPeriod();

    // Get all users with unbilled usage
    const unbilledRecords = await this.prisma.usageRecord.findMany({
      where: {
        period,
        billed: false,
        amount: { gt: 0 },
      },
      include: {
        user: true,
      },
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const record of unbilledRecords) {
      processed++;

      if (!record.user.stripeCustomerId) {
        failed++;
        continue;
      }

      const result = await this.generateMonthlyBilling({
        userId: record.userId,
        stripeCustomerId: record.user.stripeCustomerId,
        period,
      });

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    this.logger.log(
      `Monthly billing complete: ${processed} processed, ${succeeded} succeeded, ${failed} failed`,
    );

    return { processed, succeeded, failed };
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private getPreviousPeriod(): string {
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private toEntity(record: any): UsageEntity {
    return {
      id: record.id,
      period: record.period,
      amount: record.amount,
      usageCount: record.usageCount,
      description: record.description,
      billed: record.billed,
      paymentId: record.paymentId,
      createdAt: record.createdAt,
    };
  }
}
```

**Step 4: Create controller**

```typescript
// backend/src/usage/usage.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsageService } from './usage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateUsageDto } from './dto/create-usage.dto';

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async recordUsage(@Request() req, @Body() createUsageDto: CreateUsageDto) {
    const usage = await this.usageService.recordUsage({
      userId: req.user.id,
      amount: createUsageDto.amount,
      usageCount: createUsageDto.usageCount,
      description: createUsageDto.description,
    });

    return { usage };
  }

  @Get()
  async findAll(@Request() req) {
    const usage = await this.usageService.findByUser(req.user.id);
    return { usage };
  }

  @Get('preview')
  async previewNextBill(@Request() req) {
    const preview = await this.usageService.previewNextBill(req.user.id);
    return { preview };
  }

  @Post('billing/generate')
  @HttpCode(HttpStatus.OK)
  async generateBilling(@Request() req) {
    const result = await this.usageService.generateMonthlyBilling({
      userId: req.user.id,
      stripeCustomerId: req.user.stripeCustomerId,
    });

    return result;
  }
}

// Admin controller for running all billing
@Controller('admin/billing')
@UseGuards(JwtAuthGuard)
export class AdminBillingController {
  constructor(private readonly usageService: UsageService) {}

  @Post('run-monthly')
  @HttpCode(HttpStatus.OK)
  async runMonthlyBilling() {
    const result = await this.usageService.generateAllMonthlyBilling();
    return result;
  }
}
```

**Step 5: Create module**

```typescript
// backend/src/usage/usage.module.ts
import { Module } from '@nestjs/common';
import { UsageService } from './usage.service';
import { UsageController, AdminBillingController } from './usage.controller';
import { StripeModule } from '../stripe/stripe.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';

@Module({
  imports: [StripeModule, PaymentMethodsModule],
  controllers: [UsageController, AdminBillingController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
```

**Step 6: Commit**

```bash
git add backend/src/usage/
git commit -m "feat: add usage and billing module with monthly billing support"
```

---

### Task 12: Webhooks Module

**Files:**
- Create: `backend/src/webhooks/webhooks.module.ts`
- Create: `backend/src/webhooks/webhooks.service.ts`
- Create: `backend/src/webhooks/webhooks.controller.ts`

**Step 1: Create service**

```typescript
// backend/src/webhooks/webhooks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { RedisService } from '../redis/redis.service';
import Stripe from 'stripe';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async processWebhook(payload: string | Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw error;
    }

    // Store event
    await this.prisma.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        data: event.data as any,
      },
    });

    // Acquire lock to prevent duplicate processing
    const lockAcquired = await this.redisService.acquireWebhookLock(event.id);
    if (!lockAcquired) {
      this.logger.warn(`Webhook ${event.id} already being processed`);
      return;
    }

    try {
      await this.handleEvent(event);

      // Mark as processed
      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`Failed to process webhook ${event.id}: ${error.message}`);

      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: { error: error.message },
      });
    } finally {
      await this.redisService.releaseWebhookLock(event.id);
    }
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.requires_action':
        await this.handlePaymentIntentRequiresAction(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'setup_intent.succeeded':
        await this.handleSetupIntentSucceeded(
          event.data.object as Stripe.SetupIntent,
        );
        break;

      case 'setup_intent.setup_failed':
        await this.handleSetupIntentFailed(
          event.data.object as Stripe.SetupIntent,
        );
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const record = await this.prisma.paymentRecord.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!record) {
      this.logger.warn(
        `Payment intent ${paymentIntent.id} not found in database`,
      );
      return;
    }

    await this.prisma.paymentRecord.update({
      where: { id: record.id },
      data: {
        status: 'SUCCEEDED',
        errorMessage: null,
      },
    });

    this.logger.log(`Payment ${paymentIntent.id} marked as succeeded`);
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const record = await this.prisma.paymentRecord.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!record) {
      this.logger.warn(
        `Payment intent ${paymentIntent.id} not found in database`,
      );
      return;
    }

    await this.prisma.paymentRecord.update({
      where: { id: record.id },
      data: {
        status: 'FAILED',
        errorMessage: paymentIntent.last_payment_error?.message,
      },
    });

    this.logger.log(`Payment ${paymentIntent.id} marked as failed`);
  }

  private async handlePaymentIntentRequiresAction(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const record = await this.prisma.paymentRecord.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!record) {
      this.logger.warn(
        `Payment intent ${paymentIntent.id} not found in database`,
      );
      return;
    }

    await this.prisma.paymentRecord.update({
      where: { id: record.id },
      data: {
        status: 'REQUIRES_ACTION',
      },
    });

    this.logger.log(`Payment ${paymentIntent.id} requires action`);
  }

  private async handleSetupIntentSucceeded(
    setupIntent: Stripe.SetupIntent,
  ): Promise<void> {
    // Payment method is now saved - webhook confirms it
    this.logger.log(
      `Setup intent ${setupIntent.id} succeeded for customer ${setupIntent.customer}`,
    );
  }

  private async handleSetupIntentFailed(
    setupIntent: Stripe.SetupIntent,
  ): Promise<void> {
    this.logger.error(
      `Setup intent ${setupIntent.id} failed: ${setupIntent.last_setup_error?.message}`,
    );
  }
}
```

**Step 2: Create controller**

```typescript
// backend/src/webhooks/webhooks.controller.ts
import {
  Controller,
  Post,
  Headers,
  Body,
  RawBody,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('stripe/webhook')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() payload: Buffer,
  ) {
    await this.webhooksService.processWebhook(payload, signature);
    return { received: true };
  }
}
```

**Step 3: Create module**

```typescript
// backend/src/webhooks/webhooks.module.ts
import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [StripeModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
```

**Step 4: Commit**

```bash
git add backend/src/webhooks/
git commit -m "feat: add webhooks module with idempotent processing"
```

---

### Task 13: Update Main App Module

**Files:**
- Modify: `backend/src/app.module.ts`

**Step 1: Update app.module.ts**

```typescript
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { StripeModule } from './stripe/stripe.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { PaymentsModule } from './payments/payments.module';
import { UsageModule } from './usage/usage.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    StripeModule,
    AuthModule,
    UsersModule,
    PaymentMethodsModule,
    PaymentsModule,
    UsageModule,
    WebhooksModule,
  ],
})
export class AppModule {}
```

**Step 2: Commit**

```bash
git add backend/src/app.module.ts
git commit -m "chore: wire up all modules in app.module.ts"
```

---

## Phase 4: Frontend Setup

### Task 14: Frontend Dependencies & Stripe Setup

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/.env.local`
- Create: `frontend/.env.example`

**Step 1: Add dependencies to frontend/package.json**

```json
{
  "dependencies": {
    "@base-ui/react": "^1.3.0",
    "@phosphor-icons/react": "^2.1.10",
    "@stripe/react-stripe-js": "^3.6.0",
    "@stripe/stripe-js": "^6.1.0",
    "@tanstack/react-query": "^5.67.3",
    "axios": "^1.8.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "next": "16.1.6",
    "next-themes": "^0.4.6",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-hook-form": "^7.54.2",
    "shadcn": "^4.0.5",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@tailwindcss/postcss": "^4.1.18",
    "@types/node": "^25.1.0",
    "@types/react": "^19.2.10",
    "@types/react-dom": "^19.2.3",
    "eslint": "^9.39.2",
    "eslint-config-next": "16.1.6",
    "postcss": "^8",
    "prettier": "^3.8.1",
    "prettier-plugin-tailwindcss": "^0.7.2",
    "tailwindcss": "^4.1.18",
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Install dependencies**

```bash
cd frontend && npm install
```

**Step 3: Create .env.local**

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

**Step 4: Create .env.example**

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

**Step 5: Commit**

```bash
git add frontend/package.json frontend/.env.local frontend/.env.example
git commit -m "setup: add frontend dependencies for Stripe and API integration"
```

---

### Task 15: Frontend API Client & Types

**Files:**
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/stripe-client.ts`
- Create: `frontend/types/index.ts`

**Step 1: Create API client**

```typescript
// frontend/lib/api.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// Payment Methods API
export const paymentMethodsApi = {
  list: () => api.get('/payment-methods'),
  createSetupIntent: () => api.post('/payment-methods/setup-intent'),
  savePaymentMethod: (paymentMethodId: string) =>
    api.post('/payment-methods/save', { paymentMethodId }),
  setDefault: (id: string) => api.post(`/payment-methods/${id}/default`),
  remove: (id: string) => api.delete(`/payment-methods/${id}`),
};

// Payments API
export const paymentsApi = {
  createIntent: (data: {
    amount: number;
    currency: string;
    paymentMethodId?: string;
    description?: string;
  }) => api.post('/payments/intent', data),
  confirm: (id: string) => api.post(`/payments/${id}/confirm`),
  list: () => api.get('/payments'),
  get: (id: string) => api.get(`/payments/${id}`),
  retry: (id: string) => api.post(`/payments/${id}/retry`),
};

// Usage API
export const usageApi = {
  record: (data: {
    amount: number;
    usageCount: number;
    description?: string;
  }) => api.post('/usage', data),
  list: () => api.get('/usage'),
  preview: () => api.get('/usage/preview'),
  generateBilling: () => api.post('/usage/billing/generate'),
};
```

**Step 2: Create Stripe client**

```typescript
// frontend/lib/stripe-client.ts
import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      throw new Error('Stripe publishable key not found');
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
};
```

**Step 3: Create types**

```typescript
// frontend/types/index.ts
export interface User {
  id: string;
  email: string;
  name?: string;
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string;
}

export interface PaymentMethod {
  id: string;
  stripePmId: string;
  type: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'REQUIRES_ACTION';
  paymentMethodId?: string;
  description?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  period: string;
  amount: number;
  usageCount: number;
  description?: string;
  billed: boolean;
  paymentId?: string;
  createdAt: string;
}

export interface BillingPreview {
  period: string;
  totalAmount: number;
  usageCount: number;
  description: string;
}
```

**Step 4: Commit**

```bash
git add frontend/lib/api.ts frontend/lib/stripe-client.ts frontend/types/index.ts
git commit -m "feat: add frontend API client and types"
```

---

### Task 16: React Query Provider & Hooks

**Files:**
- Create: `frontend/components/providers.tsx`
- Create: `frontend/hooks/useAuth.ts`
- Create: `frontend/hooks/usePaymentMethods.ts`
- Create: `frontend/hooks/usePayments.ts`
- Create: `frontend/hooks/useUsage.ts`
- Modify: `frontend/app/layout.tsx`

**Step 1: Create providers component**

```typescript
// frontend/components/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Step 2: Create useAuth hook**

```typescript
// frontend/hooks/useAuth.ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import type { User } from '@/types';

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const { data } = await authApi.me();
      return data as User;
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (response) => {
      localStorage.setItem('token', response.data.accessToken);
      queryClient.setQueryData(['user'], response.data.user);
      router.push('/dashboard');
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (response) => {
      localStorage.setItem('token', response.data.accessToken);
      queryClient.setQueryData(['user'], response.data.user);
      router.push('/dashboard');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      localStorage.removeItem('token');
      queryClient.clear();
      router.push('/auth/login');
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
```

**Step 3: Create usePaymentMethods hook**

```typescript
// frontend/hooks/usePaymentMethods.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentMethodsApi } from '@/lib/api';
import type { PaymentMethod } from '@/types';

export function usePaymentMethods() {
  const queryClient = useQueryClient();

  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: async () => {
      const { data } = await paymentMethodsApi.list();
      return data.paymentMethods as PaymentMethod[];
    },
  });

  const createSetupIntentMutation = useMutation({
    mutationFn: paymentMethodsApi.createSetupIntent,
  });

  const savePaymentMethodMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      paymentMethodsApi.savePaymentMethod(paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => paymentMethodsApi.setDefault(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => paymentMethodsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  return {
    paymentMethods: paymentMethods || [],
    isLoading,
    createSetupIntent: createSetupIntentMutation.mutateAsync,
    savePaymentMethod: savePaymentMethodMutation.mutate,
    setDefault: setDefaultMutation.mutate,
    remove: removeMutation.mutate,
    isSaving: savePaymentMethodMutation.isPending,
    isSettingDefault: setDefaultMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
```

**Step 4: Create usePayments hook**

```typescript
// frontend/hooks/usePayments.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/lib/api';
import type { Payment } from '@/types';

export function usePayments() {
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data } = await paymentsApi.list();
      return data.payments as Payment[];
    },
  });

  const createIntentMutation = useMutation({
    mutationFn: paymentsApi.createIntent,
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });

  return {
    payments: payments || [],
    isLoading,
    createIntent: createIntentMutation.mutateAsync,
    confirm: confirmMutation.mutate,
    retry: retryMutation.mutate,
    isCreating: createIntentMutation.isPending,
    isConfirming: confirmMutation.isPending,
    isRetrying: retryMutation.isPending,
  };
}
```

**Step 5: Create useUsage hook**

```typescript
// frontend/hooks/useUsage.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usageApi } from '@/lib/api';
import type { UsageRecord, BillingPreview } from '@/types';

export function useUsage() {
  const queryClient = useQueryClient();

  const { data: usage, isLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const { data } = await usageApi.list();
      return data.usage as UsageRecord[];
    },
  });

  const { data: preview } = useQuery({
    queryKey: ['billingPreview'],
    queryFn: async () => {
      const { data } = await usageApi.preview();
      return data.preview as BillingPreview | null;
    },
  });

  const recordMutation = useMutation({
    mutationFn: usageApi.record,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      queryClient.invalidateQueries({ queryKey: ['billingPreview'] });
    },
  });

  const generateBillingMutation = useMutation({
    mutationFn: usageApi.generateBilling,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['billingPreview'] });
    },
  });

  return {
    usage: usage || [],
    preview,
    isLoading,
    record: recordMutation.mutate,
    generateBilling: generateBillingMutation.mutate,
    isRecording: recordMutation.isPending,
    isGenerating: generateBillingMutation.isPending,
  };
}
```

**Step 6: Update layout.tsx**

```typescript
// frontend/app/layout.tsx
import { Geist, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/components/providers';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('antialiased', fontMono.variable, 'font-sans', inter.variable)}
    >
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 7: Commit**

```bash
git add frontend/components/providers.tsx frontend/hooks/ frontend/app/layout.tsx
git commit -m "feat: add React Query hooks for auth, payments, and usage"
```

---

### Task 17: Auth Pages

**Files:**
- Create: `frontend/app/auth/layout.tsx`
- Create: `frontend/app/auth/login/page.tsx`
- Create: `frontend/app/auth/register/page.tsx`

**Step 1: Create auth layout**

```typescript
// frontend/app/auth/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">{children}</div>
    </div>
  );
}
```

**Step 2: Create login page**

```typescript
// frontend/app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="rounded-lg bg-white p-8 shadow-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-gray-600">Welcome back</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isLoggingIn}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoggingIn ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <Link href="/auth/register" className="text-blue-600 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
```

**Step 3: Create register page**

```typescript
// frontend/app/auth/register/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { register, isRegistering } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register({ email, password, name });
  };

  return (
    <div className="rounded-lg bg-white p-8 shadow-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="mt-2 text-gray-600">Get started with Stripe Payments</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isRegistering}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isRegistering ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/app/auth/
git commit -m "feat: add auth pages with login and register"
```

---

### Task 18: Stripe Payment Components

**Files:**
- Create: `frontend/components/stripe/StripeProvider.tsx`
- Create: `frontend/components/stripe/PaymentElementForm.tsx`
- Create: `frontend/components/stripe/SetupIntentForm.tsx`

**Step 1: Create Stripe provider**

```typescript
// frontend/components/stripe/StripeProvider.tsx
'use client';

import { Elements } from '@stripe/react-stripe-js';
import { Stripe, StripeElementsOptions } from '@stripe/stripe-js';

interface StripeProviderProps {
  stripe: Promise<Stripe | null>;
  options?: StripeElementsOptions;
  children: React.ReactNode;
}

export function StripeProvider({ stripe, options, children }: StripeProviderProps) {
  return (
    <Elements stripe={stripe} options={options}>
      {children}
    </Elements>
  );
}
```

**Step 2: Create SetupIntent form for saving payment methods**

```typescript
// frontend/components/stripe/SetupIntentForm.tsx
'use client';

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

interface SetupIntentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SetupIntentForm({
  clientSecret,
  onSuccess,
  onCancel,
}: SetupIntentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { savePaymentMethod } = usePaymentMethods();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: submitError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'An error occurred');
      setIsLoading(false);
      return;
    }

    if (setupIntent.status === 'succeeded') {
      // Save to our backend
      savePaymentMethod(setupIntent.payment_method as string);
      onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isLoading}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save card'}
        </button>
      </div>
    </form>
  );
}
```

**Step 3: Create PaymentElement form for immediate payments**

```typescript
// frontend/components/stripe/PaymentElementForm.tsx
'use client';

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { usePayments } from '@/hooks/usePayments';

interface PaymentElementFormProps {
  clientSecret: string;
  paymentIntentId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentElementForm({
  clientSecret,
  paymentIntentId,
  onSuccess,
  onCancel,
}: PaymentElementFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { confirm } = usePayments();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'An error occurred');
      setIsLoading(false);
      return;
    }

    if (paymentIntent.status === 'succeeded') {
      confirm(paymentIntentId);
      onSuccess();
    } else if (paymentIntent.status === 'requires_action') {
      // 3D Secure or other action required
      // The confirmation above should handle this automatically
      setError('Additional authentication required. Please check your email.');
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isLoading}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Pay now'}
        </button>
      </div>
    </form>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/components/stripe/
git commit -m "feat: add Stripe payment components with PaymentElement and SetupIntent forms"
```

---

### Task 19: Dashboard & Protected Layout

**Files:**
- Create: `frontend/app/dashboard/layout.tsx`
- Create: `frontend/app/dashboard/page.tsx`
- Create: `frontend/components/Navbar.tsx`

**Step 1: Create Navbar component**

```typescript
// frontend/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export function Navbar() {
  const { user, logout, isLoggingOut } = useAuth();

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold">
              Stripe Payments
            </Link>
            <div className="hidden gap-4 md:flex">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/payment-methods"
                className="text-gray-600 hover:text-gray-900"
              >
                Payment Methods
              </Link>
              <Link
                href="/payments"
                className="text-gray-600 hover:text-gray-900"
              >
                Payments
              </Link>
              <Link href="/usage" className="text-gray-600 hover:text-gray-900">
                Usage
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {isLoggingOut ? '...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Create dashboard layout**

```typescript
// frontend/app/dashboard/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Navbar } from '@/components/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
```

**Step 3: Create dashboard page**

```typescript
// frontend/app/dashboard/page.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useUsage } from '@/hooks/useUsage';
import { usePayments } from '@/hooks/usePayments';

export default function DashboardPage() {
  const { user } = useAuth();
  const { paymentMethods } = usePaymentMethods();
  const { preview } = useUsage();
  const { payments } = usePayments();

  const defaultPaymentMethod = paymentMethods.find((pm) => pm.isDefault);
  const recentPayments = payments.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back, {user?.name || user?.email}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Payment Method Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Default Payment Method</h2>
          {defaultPaymentMethod ? (
            <div className="mt-4">
              <p className="font-medium">
                {defaultPaymentMethod.brand?.toUpperCase()} ****{' '}
                {defaultPaymentMethod.last4}
              </p>
              <p className="text-sm text-gray-500">
                Expires {defaultPaymentMethod.expMonth}/
                {defaultPaymentMethod.expYear}
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-gray-500">No default payment method</p>
              <Link
                href="/payment-methods"
                className="mt-2 inline-block text-blue-600 hover:underline"
              >
                Add one now →
              </Link>
            </div>
          )}
        </div>

        {/* Current Usage Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Current Usage</h2>
          {preview ? (
            <div className="mt-4">
              <p className="text-2xl font-bold">
                ${(preview.totalAmount / 100).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">
                {preview.usageCount} units this period
              </p>
              <p className="text-xs text-gray-400">Period: {preview.period}</p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-gray-500">No usage recorded this period</p>
            </div>
          )}
        </div>

        {/* Quick Actions Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <div className="mt-4 space-y-2">
            <Link
              href="/payments/make"
              className="block rounded-md bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700"
            >
              Make Payment
            </Link>
            <Link
              href="/payment-methods/add"
              className="block rounded-md border border-gray-300 px-4 py-2 text-center text-gray-700 hover:bg-gray-50"
            >
              Add Payment Method
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Payments</h2>
          <Link
            href="/payments"
            className="text-sm text-blue-600 hover:underline"
          >
            View all →
          </Link>
        </div>

        {recentPayments.length > 0 ? (
          <div className="mt-4 divide-y">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center py-3">
                <div className="flex-1">
                  <p className="font-medium">
                    ${(payment.amount / 100).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {payment.description || 'Payment'}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      payment.status === 'SUCCEEDED'
                        ? 'bg-green-100 text-green-800'
                        : payment.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {payment.status}
                  </span>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(payment.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-gray-500">No payments yet</p>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/app/dashboard/ frontend/components/Navbar.tsx
git commit -m "feat: add dashboard with overview cards and recent payments"
```

---

### Task 20: Payment Methods Pages

**Files:**
- Create: `frontend/app/payment-methods/page.tsx`
- Create: `frontend/app/payment-methods/add/page.tsx`

**Step 1: Create payment methods list page**

```typescript
// frontend/app/payment-methods/page.tsx
'use client';

import Link from 'next/link';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { Navbar } from '@/components/Navbar';

export default function PaymentMethodsPage() {
  const { paymentMethods, isLoading, setDefault, remove, isSettingDefault, isRemoving } =
    usePaymentMethods();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Payment Methods</h1>
          <Link
            href="/payment-methods/add"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Add New
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-8 text-center">Loading...</div>
        ) : paymentMethods.length === 0 ? (
          <div className="mt-8 rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-500">No payment methods saved yet</p>
            <Link
              href="/payment-methods/add"
              className="mt-4 inline-block text-blue-600 hover:underline"
            >
              Add your first payment method →
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`rounded-lg bg-white p-6 shadow ${
                  method.isDefault ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg font-bold">
                      {method.brand?.[0]?.toUpperCase() || '💳'}
                    </div>
                    <div>
                      <p className="font-medium">
                        {method.brand?.toUpperCase() || 'Card'} **** {method.last4}
                      </p>
                      <p className="text-sm text-gray-500">
                        Expires {method.expMonth}/{method.expYear}
                      </p>
                    </div>
                    {method.isDefault && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                        Default
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <button
                        onClick={() => setDefault(method.id)}
                        disabled={isSettingDefault}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => remove(method.id)}
                      disabled={isRemoving}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Create add payment method page**

```typescript
// frontend/app/payment-methods/add/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { SetupIntentForm } from '@/components/stripe/SetupIntentForm';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { Navbar } from '@/components/Navbar';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export default function AddPaymentMethodPage() {
  const router = useRouter();
  const { createSetupIntent } = usePaymentMethods();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSetupIntent = async () => {
      try {
        const { data } = await createSetupIntent();
        setClientSecret(data.clientSecret);
      } catch (err) {
        setError('Failed to initialize payment form');
      } finally {
        setIsLoading(false);
      }
    };

    initSetupIntent();
  }, [createSetupIntent]);

  const handleSuccess = () => {
    router.push('/payment-methods');
  };

  const handleCancel = () => {
    router.push('/payment-methods');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Add Payment Method</h1>
        <p className="mt-2 text-gray-600">
          Enter your card details below. This card will be saved for future
          payments.
        </p>

        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          {isLoading ? (
            <div className="py-12 text-center">Loading payment form...</div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>
          ) : clientSecret ? (
            <StripeProvider
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <SetupIntentForm
                clientSecret={clientSecret}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </StripeProvider>
          ) : null}
        </div>
      </main>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/app/payment-methods/
git commit -m "feat: add payment methods pages with Stripe SetupIntent integration"
```

---

### Task 21: Payments Pages

**Files:**
- Create: `frontend/app/payments/page.tsx`
- Create: `frontend/app/payments/make/page.tsx`

**Step 1: Create payments list page**

```typescript
// frontend/app/payments/page.tsx
'use client';

import { usePayments } from '@/hooks/usePayments';
import { Navbar } from '@/components/Navbar';

export default function PaymentsPage() {
  const { payments, isLoading, retry, isRetrying } = usePayments();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Payment History</h1>

        {isLoading ? (
          <div className="mt-8 text-center">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="mt-8 rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-500">No payments yet</p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {payment.description || 'Payment'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      ${(payment.amount / 100).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          payment.status === 'SUCCEEDED'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : payment.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {payment.status === 'FAILED' && (
                        <button
                          onClick={() => retry(payment.id)}
                          disabled={isRetrying}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Create make payment page**

```typescript
// frontend/app/payments/make/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { PaymentElementForm } from '@/components/stripe/PaymentElementForm';
import { usePayments } from '@/hooks/usePayments';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { Navbar } from '@/components/Navbar';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export default function MakePaymentPage() {
  const router = useRouter();
  const { createIntent, isCreating } = usePayments();
  const { paymentMethods } = usePaymentMethods();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'payment'>('form');

  const defaultPaymentMethod = paymentMethods.find((pm) => pm.isDefault);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountCents = Math.round(parseFloat(amount) * 100);

    try {
      const { data } = await createIntent({
        amount: amountCents,
        currency: 'usd',
        paymentMethodId: selectedPaymentMethod || undefined,
        description: description || undefined,
      });

      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setStep('payment');
    } catch (error) {
      alert('Failed to create payment. Please try again.');
    }
  };

  const handleSuccess = () => {
    router.push('/payments');
  };

  const handleCancel = () => {
    setStep('form');
    setClientSecret(null);
    setPaymentIntentId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Make a Payment</h1>

        {step === 'form' ? (
          <form onSubmit={handleSubmitForm} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Amount (USD)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="0.50"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="block w-full rounded-md border border-gray-300 py-2 pl-7 pr-3 focus:border-blue-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="What is this payment for?"
              />
            </div>

            {paymentMethods.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Payment Method
                </label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">
                    Use default ({defaultPaymentMethod?.brand} ****{' '}
                    {defaultPaymentMethod?.last4})
                  </option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.brand?.toUpperCase()} **** {pm.last4}
                      {pm.isDefault ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isCreating || !amount}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreating ? 'Initializing...' : 'Continue to Payment'}
            </button>
          </form>
        ) : clientSecret && paymentIntentId ? (
          <div className="mt-8">
            <div className="mb-4 rounded-md bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Paying: <strong>${parseFloat(amount).toFixed(2)}</strong>
              </p>
            </div>
            <StripeProvider
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <PaymentElementForm
                clientSecret={clientSecret}
                paymentIntentId={paymentIntentId}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </StripeProvider>
          </div>
        ) : null}
      </main>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/app/payments/
git commit -m "feat: add payments pages with PaymentIntent integration"
```

---

### Task 22: Usage Page

**Files:**
- Create: `frontend/app/usage/page.tsx`

**Step 1: Create usage page**

```typescript
// frontend/app/usage/page.tsx
'use client';

import { useUsage } from '@/hooks/useUsage';
import { Navbar } from '@/components/Navbar';

export default function UsagePage() {
  const { usage, preview, isLoading, generateBilling, isGenerating } = useUsage();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Usage & Billing</h1>
          <button
            onClick={() => generateBilling()}
            disabled={isGenerating}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? 'Processing...' : 'Generate Bill Now'}
          </button>
        </div>

        {/* Current Period Preview */}
        {preview && (
          <div className="mt-8 rounded-lg bg-blue-50 p-6">
            <h2 className="text-lg font-semibold text-blue-900">
              Current Period: {preview.period}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-blue-600">Total Amount</p>
                <p className="text-2xl font-bold text-blue-900">
                  ${(preview.totalAmount / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Usage Count</p>
                <p className="text-2xl font-bold text-blue-900">
                  {preview.usageCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Description</p>
                <p className="text-blue-900">{preview.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Usage History */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold">Usage History</h2>

          {isLoading ? (
            <div className="mt-4 text-center">Loading...</div>
          ) : usage.length === 0 ? (
            <div className="mt-4 rounded-lg bg-white p-8 text-center shadow">
              <p className="text-gray-500">No usage recorded yet</p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg bg-white shadow">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Usage Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usage.map((record) => (
                    <tr key={record.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {record.period}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {record.description || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {record.usageCount}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        ${(record.amount / 100).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {record.billed ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                            Billed
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/usage/
git commit -m "feat: add usage page with billing preview and history"
```

---

### Task 23: Frontend Dockerfile

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`

**Step 1: Write Dockerfile**

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**Step 2: Write .dockerignore**

```
node_modules
.next
.git
.env
.env.local
.env.*.local
*.log
npm-debug.log*
.DS_Store
.vscode
.idea
coverage
```

**Step 3: Commit**

```bash
git add frontend/Dockerfile frontend/.dockerignore
git commit -m "infra: add frontend Dockerfile"
```

---

### Task 24: Update Landing Page

**Files:**
- Modify: `frontend/app/page.tsx`

**Step 1: Update landing page**

```typescript
// frontend/app/page.tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900">
          Stripe Payments
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Embedded payments, usage-based billing, and customer management
        </p>
        
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/auth/register"
            className="rounded-lg bg-blue-600 px-6 py-3 text-lg font-medium text-white hover:bg-blue-700"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-lg font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="text-3xl">💳</div>
            <h3 className="mt-2 font-semibold">Save Payment Methods</h3>
            <p className="mt-1 text-sm text-gray-500">
              Securely store cards and bank accounts for future payments
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="text-3xl">⚡</div>
            <h3 className="mt-2 font-semibold">Instant Payments</h3>
            <p className="mt-1 text-sm text-gray-500">
              Pay any amount without leaving the app
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="text-3xl">📊</div>
            <h3 className="mt-2 font-semibold">Usage Billing</h3>
            <p className="mt-1 text-sm text-gray-500">
              Automatic monthly billing based on your usage
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: update landing page with app features"
```

---

## Phase 5: Final Setup & Testing

### Task 25: Environment Configuration & Documentation

**Files:**
- Create: `README.md`
- Create: `.env.example` (root)

**Step 1: Write root README**

```markdown
# Stripe Payment System

A full-stack payment application with embedded Stripe integration, usage-based billing, and Docker deployment.

## Features

- 🔐 JWT Authentication
- 💳 Save & manage payment methods (cards, bank accounts)
- ⚡ Make instant payments without redirects
- 📊 Usage-based monthly billing
- 🐳 Docker Compose setup with PostgreSQL & Redis
- 🔄 Webhook handling with idempotency
- ⏱️ Rate limiting on payment endpoints

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Stripe account (test mode)
- Node.js 22+ (for local development)

### 1. Clone & Setup

```bash
git clone <repo-url>
cd stripe-payment-system
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Stripe keys
# Get keys from: https://dashboard.stripe.com/test/apikeys
```

### 3. Start Services

```bash
# Start all services (PostgreSQL, Redis, Backend, Frontend)
docker-compose up -d

# Or run in foreground to see logs
docker-compose up
```

### 4. Setup Database

```bash
# Run Prisma migrations
docker-compose exec backend npx prisma migrate dev --name init

# Generate Prisma client
docker-compose exec backend npx prisma generate
```

### 5. Configure Stripe Webhooks

For local development, use Stripe CLI:

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to your local backend
stripe listen --forward-to localhost:3001/stripe/webhook

# Copy the webhook secret to your .env file
```

### 6. Access the App

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Development

### Backend Development

```bash
cd backend
pnpm install
pnpm start:dev
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Database Migrations

```bash
# Create migration
docker-compose exec backend npx prisma migrate dev --name <migration-name>

# View database with Prisma Studio
docker-compose exec backend npx prisma studio
```

## API Endpoints

### Authentication
- `POST /auth/register` - Create account
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Payment Methods
- `GET /payment-methods` - List saved methods
- `POST /payment-methods/setup-intent` - Create SetupIntent
- `POST /payment-methods/save` - Save new method
- `POST /payment-methods/:id/default` - Set default
- `DELETE /payment-methods/:id` - Remove method

### Payments
- `POST /payments/intent` - Create PaymentIntent
- `POST /payments/:id/confirm` - Confirm payment
- `GET /payments` - List payments
- `POST /payments/:id/retry` - Retry failed payment

### Usage & Billing
- `POST /usage` - Record usage
- `GET /usage` - List usage history
- `GET /usage/preview` - Preview next bill
- `POST /usage/billing/generate` - Generate bill

### Webhooks
- `POST /stripe/webhook` - Stripe webhooks

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js Frontend (Port 3000)                           │
│  - React 19, Tailwind v4, Stripe.js                     │
│  - Embedded Payment Element (no redirects)              │
├─────────────────────────────────────────────────────────┤
│  NestJS Backend (Port 3001)                             │
│  - REST API with JWT auth                               │
│  - Prisma ORM with PostgreSQL                           │
│  - Redis for sessions, rate limiting, idempotency     │
│  - Stripe SDK integration                               │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (Port 5432) - Source of Truth               │
│  Redis (Port 6379) - Cache & Sessions                 │
└─────────────────────────────────────────────────────────┘
```

## Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Success |
| 4000 0027 6000 3184 | Requires 3D Secure |
| 4000 0084 0000 1280 | Insufficient funds |
| 4000 0000 0000 9995 | Declined |

## License

MIT
```

**Step 2: Update root .env.example**

```
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stripe

# Redis
REDIS_URL=redis://:redis@localhost:6379

# Stripe (replace with your keys from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# App
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

**Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "docs: add comprehensive README with setup instructions"
```

---

## Summary

This implementation plan creates a complete Stripe payment system with:

### Backend (NestJS)
- ✅ PostgreSQL with Prisma ORM
- ✅ Redis for sessions, rate limiting, idempotency
- ✅ JWT authentication
- ✅ Stripe integration (customers, payment methods, payment intents)
- ✅ Webhook handling with idempotent processing
- ✅ Usage-based billing (no Stripe invoices)
- ✅ Rate limiting on payment endpoints

### Frontend (Next.js)
- ✅ React Query for data fetching
- ✅ Stripe.js with Payment Element (embedded, no redirect)
- ✅ Auth pages (login/register)
- ✅ Dashboard with overview
- ✅ Payment methods management
- ✅ Payment history & retry
- ✅ Usage tracking & billing

### Infrastructure
- ✅ Docker Compose with all services
- ✅ Static IP configuration for service communication
- ✅ Health checks for dependencies
- ✅ Volume persistence for data

### Next Steps After Implementation

1. **Run the implementation** using the executing-plans skill
2. **Set up Stripe CLI** for webhook forwarding locally
3. **Create a Stripe account** and get API keys
4. **Test the flows** with Stripe test cards
5. **Deploy** to production with proper environment variables

**Ready to execute?** Use `/execute-plan` or invoke the `executing-plans` skill to begin implementation.
