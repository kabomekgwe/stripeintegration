# Coding Conventions

**Analysis Date:** 2026-03-16

## Overview

This codebase is a Stripe payment processing application with a **NestJS backend** and **Next.js frontend**. Both use TypeScript with distinct but complementary conventions.

---

## Naming Patterns

### Files

| Pattern | Convention | Example |
|---------|------------|---------|
| Components (Frontend) | PascalCase | `Button.tsx`, `Navbar.tsx` |
| Pages (Frontend) | kebab-case directories, page.tsx | `app/payments/page.tsx` |
| Services (Backend) | camelCase.service.ts | `payments.service.ts` |
| Controllers (Backend) | camelCase.controller.ts | `payments.controller.ts` |
| DTOs (Backend) | PascalCase.dto.ts | `CreatePaymentDto` in `create-payment.dto.ts` |
| Entities (Backend) | PascalCase.entity.ts | `PaymentEntity` in `payment.entity.ts` |
| Modules (Backend) | camelCase.module.ts | `payments.module.ts` |
| Utilities | camelCase.ts | `utils.ts`, `formatters.ts` |
| Hooks (Frontend) | useCamelCase.ts | `useAuth.ts` |
| API Slices (Frontend) | camelCaseApi.ts | `paymentsApi.ts` |

### Variables & Functions

```typescript
// Constants - SCREAMING_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_CURRENCY = 'usd';

// Variables - camelCase
const userEmail = 'user@example.com';
const isLoading = true;

// Functions - camelCase with descriptive names
function calculateTotal(items: Item[]): number {}
async function createPaymentIntent(data: CreatePaymentDto) {}

// Classes - PascalCase
class PaymentService {}
class CreatePaymentDto {}

// Interfaces/Types - PascalCase
interface PaymentResponse {}
type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

// Private methods - camelCase with underscore prefix (backend only)
private toEntity(payment: any): PaymentEntity {}
private async generateToken(user: UserEntity): Promise<string> {}
```

### Backend-Specific NestJS Patterns

```typescript
// DTOs use validation decorators with camelCase properties
export class CreatePaymentDto {
  @IsInt()
  @Min(50)
  amount: number;

  @IsString()
  @IsIn(['usd', 'eur', 'gbp'])
  currency: string = 'usd'; // Default values in DTOs

  @IsOptional()
  @IsString()
  paymentMethodId?: string; // Optional with ?
}

// Entities use PascalCase with optional marked as ?
export class PaymentEntity {
  id: string;
  stripePaymentIntentId: string; // Descriptive, no abbreviations
  amount: number;
  currency: string;
  status: string;
  paymentMethodId?: string; // Optional
  description?: string;
  errorMessage?: string;
  createdAt: Date;
}
```

---

## Code Style

### Formatting

**Frontend (Prettier):**
```json
{
  "endOfLine": "lf",
  "semi": false,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Backend (Prettier):**
```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

### TypeScript Strictness

**Frontend (`tsconfig.json`):**
- `strict: true`
- `noEmit: true` (Next.js handles compilation)
- Path alias: `@/*` maps to `./*`

**Backend (`tsconfig.json`):**
- `strictNullChecks: true`
- `noImplicitAny: false` (NestJS decorator compatibility)
- `experimentalDecorators: true`
- `emitDecoratorMetadata: true`

---

## Import Organization

### Order (Frontend)

```typescript
// 1. React/Next.js imports
import { useState, useEffect } from 'react';
import Link from 'next/link';

// 2. Third-party libraries
import { useDispatch } from 'react-redux';

// 3. Absolute imports (path aliases)
import { useLoginMutation } from '@/store/api';
import { setCredentials } from '@/store/authSlice';

// 4. Relative imports (when necessary)
import { Navbar } from '../components/Navbar';
```

### Order (Backend)

```typescript
// 1. NestJS framework imports
import { Injectable, BadRequestException } from '@nestjs/common';

// 2. Third-party libraries
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

// 3. Internal modules (absolute imports via tsconfig paths)
import { PrismaService } from '../database/prisma.service';
import { StripeService } from '../stripe/stripe.service';

// 4. Local module imports
import { PaymentEntity } from './entities/payment.entity';
import { CreateRefundDto } from './dto/create-refund.dto';
```

---

## Error Handling

### Backend (NestJS)

Use built-in HTTP exceptions with descriptive messages:

```typescript
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';

@Injectable()
export class PaymentsService {
  async findById(id: string, userId: string): Promise<PaymentEntity | null> {
    const payment = await this.prisma.paymentRecord.findFirst({
      where: { id, userId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toEntity(payment);
  }

  async createPayment(params: CreatePaymentParams) {
    // Validation errors
    if (!currencyValidation.valid) {
      throw new BadRequestException(currencyValidation.error);
    }

    // Conflict errors
    if (await this.emailExists(data.email)) {
      throw new ConflictException('Email already exists');
    }

    // Authentication errors
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
```

### Frontend (RTK Query Error Handling)

```typescript
export default function LoginPage() {
  const [login, { isLoading, error }] = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login({ email, password }).unwrap();
      dispatch(setCredentials(result));
      router.push('/dashboard');
    } catch (err) {
      // Error handled by RTK Query, displayed from error object
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {'data' in error
            ? (error.data as { message?: string })?.message || 'Login failed'
            : 'An error occurred'}
        </div>
      )}
    </form>
  );
}
```

---

## Component Patterns

### Frontend React Components

**Server Components (default in Next.js App Router):**
```typescript
// app/dashboard/page.tsx - Server Component
export default async function DashboardPage() {
  // Can fetch data directly
  return <div>Dashboard</div>;
}
```

**Client Components (when interactivity needed):**
```typescript
'use client'; // Required directive

import { useState } from 'react';

export default function PaymentsPage() {
  const [filter, setFilter] = useState<string>('all');
  const { data, isLoading, error } = useGetPaymentsQuery();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading payments</div>;

  return <div>{/* JSX */}</div>;
}
```

**UI Components (shadcn/ui pattern):**
```typescript
"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground...",
        outline: "border-border bg-background...",
        // ...
      },
      size: {
        default: "h-8 gap-1.5 px-2.5",
        sm: "h-7 gap-1...",
        // ...
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

---

## Backend Architecture Patterns

### NestJS Module Structure

```typescript
// payments.module.ts
@Module({
  imports: [/* dependencies */],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService], // Export if other modules need it
})
export class PaymentsModule {}
```

### Service Pattern

```typescript
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async createPaymentIntent(params: {
    userId: string;
    amount: number;
    currency: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string }> {
    // Implementation
  }

  // Private helper methods at bottom
  private toEntity(payment: any): PaymentEntity {
    return {
      id: payment.id,
      // ...
    };
  }
}
```

### Controller Pattern

```typescript
@Controller('payments')
@UseGuards(JwtAuthGuard) // Auth guard at controller level
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(PaymentRateLimitGuard) // Additional guards per route
  async createPaymentIntent(
    @Request() req,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    const result = await this.paymentsService.createPaymentIntent({
      userId: req.user.id,
      ...createPaymentDto,
    });
    return result;
  }

  @Get()
  async findAll(@Request() req) {
    const payments = await this.paymentsService.findByUser(req.user.id);
    return { payments };
  }
}
```

---

## State Management (Frontend)

### Redux Toolkit with RTK Query

**Store Configuration:**
```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**API Slice Pattern:**
```typescript
// store/api/paymentsApi.ts
export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPayments: builder.query<{ payments: Payment[] }, void>({
      query: () => '/payments',
      providesTags: ['Payments'],
    }),

    createPaymentIntent: builder.mutation<PaymentIntentResponse, CreatePaymentRequest>({
      query: (data) => ({
        url: '/payments/intent',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Payments'],
    }),
  }),
});

export const {
  useGetPaymentsQuery,
  useCreatePaymentIntentMutation,
} = paymentsApi;
```

---

## Validation Patterns

### Backend DTO Validation (class-validator)

```typescript
export class CreatePaymentDto {
  @IsInt()
  @Min(50) // Minimum 50 cents
  amount: number;

  @IsString()
  @IsIn(['usd', 'eur', 'gbp'])
  currency: string = 'usd';

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDetailsDto)
  customerDetails?: CustomerDetailsDto;
}
```

### Frontend Type Safety

```typescript
// types/index.ts
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
```

---

## Comments

### When to Comment

```typescript
// GOOD - Explains WHY, not WHAT
// Use binary search here because the list is always sorted
// and can contain millions of items
const index = binarySearch(sortedItems, target);

// GOOD - Documents section dividers
// ==================== REFUNDS ====================

// GOOD - JSDoc for public APIs
/**
 * Creates a payment intent through Stripe
 * @param params - Payment parameters including amount and currency
 * @returns Client secret and payment intent ID
 * @throws {BadRequestException} When validation fails
 */
async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentResult> {}

// BAD - States the obvious
// Increment the counter
counter++;
```

---

## Function Design

### Size Guidelines

- **Maximum 30 lines** per function
- **Single responsibility** - if name needs "and", split it
- **Early returns** preferred over nested conditionals

```typescript
// GOOD - Early returns, single responsibility
async function processPayment(paymentId: string, userId: string): Promise<Payment> {
  const record = await this.findRecord(paymentId, userId);
  if (!record) {
    throw new NotFoundException('Payment not found');
  }

  if (record.status !== 'PENDING') {
    throw new BadRequestException('Payment already processed');
  }

  return this.confirmWithStripe(record);
}

// BAD - Nested conditionals, multiple responsibilities
async function processPayment(paymentId: string) {
  const record = await this.findRecord(paymentId);
  if (record) {
    if (record.status === 'PENDING') {
      // ... 20 more lines
    } else {
      // ... handle other cases
    }
  } else {
    throw new Error('Not found');
  }
}
```

---

## Module Exports

### Barrel Files

```typescript
// store/api/index.ts
export { baseApi } from './baseApi';
export * from './authApi';
export * from './paymentsApi';
export * from './subscriptionsApi';
// ...
```

### Named Exports Preferred

```typescript
// GOOD - Named exports
export { Button, buttonVariants };
export { Input };

// AVOID - Default exports for components
export default function Button() {} // Don't do this
```

---

## Environment & Configuration

### Backend (NestJS ConfigService)

```typescript
// Access environment variables through ConfigService
constructor(private readonly configService: ConfigService) {}

const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

// Check environment
if (this.configService.get('NODE_ENV') === 'development') {
  console.log('Debug info:', error);
}
```

### Frontend

```typescript
// Use environment variables with NEXT_PUBLIC_ prefix for client-side
const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
```

---

*Convention analysis: 2026-03-16*
