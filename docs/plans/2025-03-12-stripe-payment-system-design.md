# Stripe Payment System - Design Document

**Date:** 2025-03-12
**Status:** Approved

## Overview

A full-stack Stripe-integrated payment application using:
- **Frontend:** Next.js 16 + React 19 + Tailwind v4 + Stripe.js
- **Backend:** NestJS + Prisma + PostgreSQL
- **Cache:** Redis (for sessions, rate limiting, and idempotency keys)
- **Infrastructure:** Docker + Docker Compose
- **Payment:** Embedded Stripe Payment Element (no redirects)

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DOCKER NETWORK                              │
│                         (stripe-network: 172.20.0.0/24)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐        ┌──────────────────────┐              │
│  │   Next.js Frontend   │        │    NestJS Backend    │              │
│  │   Port: 3000         │◄──────▶│    Port: 3001        │              │
│  │   - Stripe.js        │        │    - REST API        │              │
│  │   - Payment Element  │        │    - Webhook handler │              │
│  │   - React Query      │        │    - Prisma ORM      │              │
│  └──────────────────────┘        └──────────┬───────────┘              │
│                                             │                          │
│                                             ▼                          │
│                              ┌──────────────────────┐                 │
│                              │      PostgreSQL      │                 │
│                              │   Port: 5432 (int)   │                 │
│                              │   Database: stripe   │                 │
│                              └──────────┬───────────┘                 │
│                                          │                            │
│                                          ▼                            │
│                              ┌──────────────────────┐                 │
│                              │       Redis          │                 │
│                              │   Port: 6379 (int)   │                 │
│                              │   - Sessions         │                 │
│                              │   - Rate limiting    │                 │
│                              │   - Idempotency      │                 │
│                              └──────────────────────┘                 │
│                                                                          │
│  ╔══════════════════════════════════════════════════════════════════╗  │
│  ║                    STRIPE DASHBOARD (External)                     ║  │
│  ║  - Webhooks → http://your-domain/stripe/webhook                   ║  │
│  ║  - API calls from Backend                                         ║  │
│  ╚══════════════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Schema (Prisma)

```prisma
// schema.prisma

model User {
  id                    String          @id @default(cuid())
  email                 String          @unique
  name                  String?
  stripeCustomerId      String?         @unique
  defaultPaymentMethodId String?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  
  paymentMethods        PaymentMethod[]
  payments              PaymentRecord[]
  usageRecords          UsageRecord[]
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
}

model PaymentRecord {
  id                      String    @id @default(cuid())
  userId                  String
  stripePaymentIntentId   String    @unique
  amount                  Int       // cents
  currency                String    @default("usd")
  status                  PaymentStatus @default(PENDING)
  paymentMethodId         String?
  description             String?
  metadata                Json?
  errorMessage            String?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  
  user                    User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([createdAt])
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
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELED
  REQUIRES_ACTION
}
```

## Redis Usage

### Key Patterns

| Purpose | Key Pattern | TTL |
|---------|-------------|-----|
| User Sessions | `session:{token}` | 24h |
| Rate Limiting | `rate_limit:{userId}:{action}` | 1m-1h |
| Idempotency Keys | `idempotency:{key}` | 24h |
| Payment Intent Cache | `pi:{paymentIntentId}` | 5m |
| Webhook Processing Lock | `webhook_lock:{eventId}` | 5m |
| Failed Payment Retry Counter | `retry:{paymentIntentId}` | 24h |

### Implementation

```typescript
// Redis Service Layer
class RedisService {
  // Rate limiting: 100 requests per minute per user
  async checkRateLimit(userId: string, action: string, limit: number, windowSeconds: number): Promise<boolean>
  
  // Idempotency: prevent duplicate Stripe API calls
  async checkIdempotency(key: string): Promise<{ exists: boolean; response?: any }>
  async setIdempotency(key: string, response: any, ttlHours: number = 24): Promise<void>
  
  // Session management
  async setSession(token: string, userId: string, ttlHours: number = 24): Promise<void>
  async getSession(token: string): Promise<string | null>
  
  // Distributed locking for webhooks
  async acquireWebhookLock(eventId: string, ttlSeconds: number = 300): Promise<boolean>
  async releaseWebhookLock(eventId: string): Promise<void>
}
```

## API Endpoints (REST)

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create user + Stripe customer |
| POST | `/auth/login` | Login, return JWT |
| POST | `/auth/logout` | Invalidate session |

### Payment Methods
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payment-methods` | List user's saved payment methods |
| POST | `/payment-methods/setup-intent` | Create SetupIntent for adding new PM |
| POST | `/payment-methods/:id/default` | Set default payment method |
| DELETE | `/payment-methods/:id` | Remove payment method |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/payments/intent` | Create PaymentIntent for immediate payment |
| POST | `/payments/:id/confirm` | Confirm payment (after client handles 3D Secure) |
| GET | `/payments/history` | Get user's payment history |
| POST | `/payments/:id/retry` | Retry failed payment |

### Usage/Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/usage` | Record usage (called by your app) |
| GET | `/usage/history` | Get usage history |
| POST | `/billing/generate` | Trigger monthly billing (admin/cron) |
| POST | `/billing/preview` | Preview next month's bill |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/stripe/webhook` | Receive Stripe webhooks |

## Frontend Components

### Structure
```
app/
├── layout.tsx              # Root with Stripe provider
├── page.tsx                # Dashboard/landing
├── auth/
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
├── dashboard/
│   ├── layout.tsx          # Protected layout
│   └── page.tsx            # Overview with usage stats
├── payment-methods/
│   ├── page.tsx            # List payment methods
│   └── add/
│       └── page.tsx        # Add new payment method
├── payments/
│   ├── page.tsx            # Payment history
│   └── make/
│       └── page.tsx        # Make immediate payment
└── usage/
    └── page.tsx            # Usage history & billing

components/
├── stripe/
│   ├── PaymentElementWrapper.tsx   # Embedded Stripe form
│   ├── SetupIntentForm.tsx         # For saving payment methods
│   └── PaymentMethodCard.tsx       # Display saved card
├── payment/
│   ├── PaymentHistory.tsx
│   ├── QuickPaymentForm.tsx
│   └── UsageDisplay.tsx
└── ui/
    └── (shadcn components)

hooks/
├── useStripe.ts
├── usePaymentMethods.ts
├── usePayments.ts
└── useUsage.ts

lib/
├── api.ts                  # Axios/fetch client
├── stripe-client.ts        # Stripe.js initialization
└── utils.ts
```

## Docker Configuration

### docker-compose.yml

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

### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build
RUN pnpm build

EXPOSE 3001

CMD ["pnpm", "start:prod"]
```

### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

## Environment Variables

### .env (Root - for Docker)
```
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stripe

# Redis
REDIS_URL=redis://:redis@localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# App
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

## Key Technical Decisions

### 1. Embedded Payments (No Redirect)
- Use Stripe Payment Element with client-side integration
- Backend creates SetupIntent/PaymentIntent, returns `client_secret`
- Frontend uses `@stripe/stripe-js` to mount element and confirm

### 2. Database-First Architecture
- All user CRUD operations go to DB first
- Stripe is treated as a "mirror" - we push changes to Stripe after DB success
- Webhooks only update payment status in DB (no business logic triggers)

### 3. Usage-Based Billing
- Cron job runs 1st of month (or manual trigger)
- Queries unbilled UsageRecord from previous month
- Creates PaymentIntent with `off_session: true` and `confirm: true`
- Uses default payment method from DB
- Updates UsageRecord.billed = true on success

### 4. Redis Usage
| Use Case | Reason |
|----------|--------|
| Sessions | Fast JWT token validation |
| Rate Limiting | Prevent abuse on payment endpoints |
| Idempotency | Prevent duplicate Stripe API calls on retries |
| Webhook Locks | Prevent duplicate webhook processing |

### 5. Docker Setup
- All services on custom network with static IPs
- Health checks ensure dependencies are ready
- Named volumes for data persistence
- Hot reload for development via volume mounts

## Security Considerations

1. **PCI Compliance**: Use Stripe Elements (Stripe hosts form inputs)
2. **Webhook Verification**: Verify Stripe signature on all webhooks
3. **Rate Limiting**: 100 req/min on payment endpoints
4. **Idempotency**: Generate keys for all payment operations
5. **CORS**: Restrict to frontend origin only
6. **Secrets**: Use Docker secrets or env files, never commit

## Testing Strategy

### Unit Tests (Jest)
- Services: PaymentService, UserService, UsageService
- Controllers: Auth, Payments, Usage
- Guards: JWT, RateLimit

### Integration Tests
- Database operations with test container
- Stripe API mocking with stripe-mock
- Redis operations

### E2E Tests (Playwright)
- Full payment flow
- Webhook handling
- Error scenarios

### Stripe Test Cards
- `4242 4242 4242 4242` - Success
- `4000 0027 6000 3184` - Requires 3D Secure
- `4000 0084 0000 1280` - Insufficient funds

## Files to Create

### Backend
```
backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── auth/
│   ├── config/
│   ├── database/
│   ├── payment-methods/
│   ├── payments/
│   ├── redis/
│   ├── stripe/
│   ├── usage/
│   ├── users/
│   └── webhooks/
├── Dockerfile
└── docker-compose.yml
```

### Frontend
```
frontend/
├── app/
│   ├── auth/
│   ├── dashboard/
│   ├── payment-methods/
│   ├── payments/
│   └── usage/
├── components/
│   ├── stripe/
│   ├── payment/
│   └── ui/
├── hooks/
├── lib/
├── types/
└── Dockerfile
```

### Root
```
/
├── docker-compose.yml
├── .env
├── .env.example
└── README.md
```
