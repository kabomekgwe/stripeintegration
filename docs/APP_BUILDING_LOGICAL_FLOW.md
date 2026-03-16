# App Building Logical Flow: Stripe Payment System

**Document Type:** Technical Architecture Guide  
**Audience:** New developers joining the team, future maintainers  
**Last Updated:** 2026-03-16  
**Project:** Stripe Payment System (NestJS + Next.js SaaS)

---

## 1. Executive Summary

### 1.1 Project Genesis

This Stripe Payment System was built to provide a **production-ready, full-stack payment platform** that handles the complexity of modern payment flows without requiring teams to rebuild common patterns from scratch. It solves the recurring problem of payment integration projects starting strong but failing to reach production readiness due to gaps in testing, security, and operational observability.

### 1.2 Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│  Next.js Frontend (Port 3000)                           │
│  - React 19, Tailwind v4, Stripe.js, RTK Query          │
│  - Embedded Payment Element (no redirects)              │
├─────────────────────────────────────────────────────────┤
│  NestJS Backend (Port 3001)                             │
│  - REST API with JWT auth                               │
│  - Prisma ORM with PostgreSQL                          │
│  - Redis for sessions, rate limiting, idempotency       │
│  - Stripe SDK integration                               │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (Port 5432) - Source of Truth               │
│  Redis (Port 6379) - Cache & Sessions                   │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Core Philosophy

Three principles guide every architectural decision:

1. **Security-First**: Payment data never touches our servers (Stripe Elements), tokens are cryptographically secure, and rate limiting protects against abuse.

2. **Test-Driven**: No feature is complete without tests. We target 80%+ coverage on all services using Vitest with factories and mocks for deterministic testing.

3. **Production-Ready**: Every feature includes observability (health checks, structured logging), error handling (Result pattern), and operational considerations (idempotency, retries).

### 1.4 Feature Scope

The platform supports the full spectrum of payment scenarios:

- **One-Time Payments**: Instant charges with saved payment methods
- **Subscriptions**: Recurring billing with tiered plans, upgrades/downgrades
- **Usage-Based Billing**: Metered billing for API calls, storage, or any metric
- **Marketplace Payments**: Stripe Connect for platform/multi-party payments
- **Global Commerce**: Multi-currency support (USD, EUR, GBP, CAD, AUD, JPY)
- **Self-Service**: Customer Portal for users to manage their own billing
- **Operational Tools**: Webhook dashboard, dispute handling, promo codes

### 1.5 Development Approach

This project follows **phased incremental improvement** rather than big-bang rewrites:

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Foundation (testing + security) | ✅ Complete |
| 2 | Core Services (type safety + coverage) | ✅ Complete |
| 3 | Webhooks & Performance | 🔄 In Progress |
| 4 | Polish (docs + frontend tests) | 📋 Planned |

Each phase delivers working, deployable code. We never break existing API contracts.

### 1.6 Current Maturity

**Where we are:** The codebase has transitioned from "works in development" to "production-hardened":

- ✅ Testing infrastructure (Vitest, coverage reporting)
- ✅ AuthService, PaymentsService, SubscriptionsService tested (80%+ coverage)
- ✅ Rate limiting (global + per-route)
- ✅ Health endpoints (/health, /health/ready)
- ✅ Type safety (Stripe webhook types defined, `any` types eliminated from core services)
- 🔄 Webhook testing in progress
- 📋 Performance optimization planned

### 1.7 Document Purpose

**Use this guide to:**
- Understand why architectural decisions were made
- Learn the logical flow of feature development
- Onboard new team members to the codebase patterns
- Make consistent decisions when adding new features
- Debug issues by understanding data flows

**Not covered here:** API reference (see README.md), component documentation (see inline JSDoc), deployment runbooks (see DevOps docs).

---

## 2. Architecture Foundation

### 2.1 Tech Stack Rationale

Each technology was chosen to solve specific problems while maintaining consistency across the stack:

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **NestJS** | Backend framework | Enterprise-grade Node.js with dependency injection, modular architecture, and first-class TypeScript support. Guards, interceptors, and decorators provide clean separation of concerns. Built-in testing utilities integrate seamlessly with Vitest. |
| **Next.js** | Frontend framework | React framework with API routes for proxying, SSR/SSG for performance, and deployment simplicity. App Router provides nested layouts and server components for reduced client-side JavaScript. |
| **Prisma** | Database ORM | Type-safe database access with auto-generated TypeScript types. Migration system ensures schema changes are version-controlled and reversible. Query optimization and connection pooling built-in. |
| **PostgreSQL** | Primary database | ACID-compliant relational database with excellent JSON support for flexible data. Row-level security and advanced indexing capabilities. Proven at scale for financial data. |
| **Redis** | In-memory store | Sessions, rate limiting, and caching in a single technology. Atomic operations support distributed locks. Pub/sub capabilities for real-time features if needed. |
| **Stripe SDK** | Payment processing | Industry standard with comprehensive API coverage. PCI compliance handled by Stripe (no card data touches our servers). Webhook system for asynchronous event handling. |
| **RTK Query** | Data fetching | Redux Toolkit's data fetching solution with automatic caching, cache invalidation via tags, and optimistic updates. Eliminates boilerplate for API calls and state management. |
| **Tailwind v4** | Styling | Utility-first CSS with minimal configuration. Design system consistency through predefined tokens. No runtime CSS-in-JS overhead. |
| **Docker Compose** | Local development | Local development parity with production. One command (`docker-compose up`) starts PostgreSQL, Redis, backend, and frontend. New developers productive in minutes, not hours. |
| **Vitest** | Testing | Fast TypeScript-native testing with modern features (ESM, top-level await). Native coverage reporting. Factory and mock utilities for deterministic tests. Integrates with NestJS testing module. |

**Stack Coherence:** All technologies are TypeScript-first, enabling end-to-end type safety from database schema to UI components. This eliminates an entire class of runtime errors and enables confident refactoring.

### 2.2 System Boundaries

Clear boundaries between frontend and backend prevent logic duplication and security gaps:

#### Frontend Responsibilities (Next.js)

| Responsibility | Description | Example |
|----------------|-------------|---------|
| **UI/UX Rendering** | Component structure, styling, responsive design | Payment form layout, loading states |
| **Client-Side Validation** | Immediate feedback before API calls | Required fields, format validation |
| **Optimistic Updates** | UI updates before API confirmation | Payment button shows "Processing" immediately |
| **Local State Management** | Form inputs, UI toggles, modal visibility | Currency selector, sidebar open/close |
| **Stripe Elements Integration** | Secure card input (PCI scope reduction) | CardElement, PaymentElement mounting |
| **API Proxying** | Next.js API routes forward to backend | `/api/payments` → backend `/payments` |
| **RTK Query Caching** | Client-side cache invalidation | `providesTags`/`invalidatesTags` patterns |
| **Error Display** | User-friendly error presentation | Toast notifications, inline field errors |

#### Backend Responsibilities (NestJS)

| Responsibility | Description | Example |
|----------------|-------------|---------|
| **Business Logic** | Payment calculations, proration, access control | Subscription upgrade cost calculation |
| **Database Transactions** | ACID operations, rollback on failure | Payment + Invoice creation in one transaction |
| **Stripe API Integration** | All Stripe SDK calls | `stripe.paymentIntents.create()` |
| **Authentication/Authorization** | JWT validation, role-based access | `@Roles(Role.ADMIN)` guards |
| **Rate Limiting** | Request throttling per endpoint | `@Throttle(5, 60)` for auth routes |
| **Webhook Processing** | Stripe events, idempotency, async handling | `invoice.payment_succeeded` handler |
| **Data Integrity** | Validation, constraints, relationships | Prisma schema enforcement |
| **Security Enforcement** | CORS, security headers, token validation | `helmet` middleware, CSRF protection |

#### The Boundary Line

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  NEXT.JS FRONTEND                                   │   │
│  │  - React components                                 │   │
│  │  - Stripe Elements (card never touches our code)    │   │
│  │  - Form state, validation                           │   │
│  │  - RTK Query cache                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  NEXT.JS API ROUTES (Proxy Layer)                   │   │
│  │  - Forward to backend                               │   │
│  │  - Add auth headers                                 │   │
│  │  - No business logic here                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  NESTJS BACKEND                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Guards → Interceptors → Controllers → Services     │   │
│  │  - JWT validation                                     │   │
│  │  - Rate limiting                                    │   │
│  │  - Business logic                                   │   │
│  │  - Stripe API calls                                 │   │
│  │  - Database transactions                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Golden Rule:** If it involves money calculation, security validation, or data persistence → backend. If it involves user interaction or display → frontend.

### 2.3 Service-Oriented Design

The backend follows **modular architecture** where each domain is self-contained and communicates through well-defined interfaces:

#### Module Structure

```
src/
├── auth/                    # Authentication domain
│   ├── auth.controller.ts   # HTTP routes
│   ├── auth.service.ts      # Business logic
│   ├── auth.module.ts       # Module definition
│   └── dto/                 # Request/response types
├── payments/                # Payment processing domain
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   ├── payments.module.ts
│   └── dto/
├── subscriptions/             # Subscription management domain
│   ├── subscriptions.controller.ts
│   ├── subscriptions.service.ts
│   ├── subscriptions.module.ts
│   └── dto/
├── webhooks/                # Stripe webhook handling
│   ├── webhooks.controller.ts
│   ├── webhooks.service.ts
│   └── webhooks.module.ts
├── common/                  # Shared kernel (utilities, guards, interceptors)
│   ├── guards/
│   ├── interceptors/
│   └── decorators/
└── app.module.ts            # Root module assembling all domains
```

#### Design Principles

| Principle | Implementation | Benefit |
|-----------|----------------|---------|
| **Domain-Driven Modules** | Auth, Payments, Subscriptions each self-contained with controllers, services, DTOs | Teams can work on domains without merge conflicts; clear ownership |
| **Single Responsibility** | `PaymentsService` handles payments only; `SubscriptionsService` handles subscriptions | Services remain small (<300 lines), focused, understandable |
| **Dependency Injection** | NestJS DI container injects `PrismaService`, `StripeService` into constructors | Testable, loosely coupled, lifecycle managed by framework |
| **Interface Segregation** | Services expose minimal public methods; private helpers hidden | Consumers can't misuse internal methods; API contracts are clear |
| **Testability** | Services receive dependencies via constructor; test provides mocks | Unit tests run in isolation; no database or Stripe calls in unit tests |
| **Reusability** | `PaymentsService` used by both one-time payments and subscriptions | DRY principle; bug fixes apply to all consumers |
| **Clear Boundaries** | Modules import from `common/` or external packages, not sibling modules | Prevents circular dependencies; enforces layering |
| **Shared Kernel** | Common utilities (guards, interceptors, decorators) in `common/` module | Cross-cutting concerns implemented once, used everywhere |
| **Feature Modules** | Each major feature is a NestJS `@Module()` with imports, controllers, providers | Declarative dependency graph; NestJS validates at startup |
| **Repository Pattern** | Prisma abstracts database access; services call `prisma.payment.findMany()` | Database can change without touching business logic |

#### Dependency Flow

```
┌─────────────────────────────────────────────────────────────┐
│  FEATURE MODULES (Auth, Payments, Subscriptions)            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ AuthModule  │  │PaymentModule│  │  SubModule   │        │
│  │             │  │             │  │             │        │
│  │ AuthService │  │PayService   │  │  SubService  │        │
│  │ AuthController│ │PayController│ │  SubController│       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │               │
│         └────────────────┼────────────────┘               │
│                          │                               │
│         ┌────────────────┴────────────────┐              │
│         ▼                                 ▼              │
│  ┌─────────────┐                 ┌─────────────┐          │
│  │  PrismaService│                │ StripeService│          │
│  │  (Database)  │                │  (External)  │          │
│  └─────────────┘                 └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │     COMMON MODULE    │
              │  Guards, Interceptors │
              │  Decorators, Utils    │
              └─────────────────────┘
```

**Module Definition Example:**

```typescript
@Module({
  imports: [CommonModule],           // Import shared utilities
  controllers: [PaymentsController], // HTTP routes
  providers: [PaymentsService],    // Business logic
  exports: [PaymentsService],        // Available to other modules
})
export class PaymentsModule {}
```

**Service Injection Example:**

```typescript
@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,      // Injected by NestJS
    private stripe: StripeService,      // Injected by NestJS
    private logger: LoggerService,      // Injected by NestJS
  ) {}

  async createPayment(dto: CreatePaymentDto) {
    // Business logic here
    // Dependencies are testable mocks in unit tests
  }
}
```

**Key Insight:** This architecture scales because new features add modules without touching existing code. A new "Invoicing" feature creates `invoices/` module, imports `PaymentsModule` if needed, and doesn't risk breaking payments.

---

## 3. Feature Development Flow

### 3.1 Feature Prioritization Framework

Features are prioritized using a **risk-based, phased approach** that ensures security and stability before adding capabilities:

#### Priority Levels

| Level | Definition | Examples | Response Time |
|-------|------------|----------|---------------|
| **Critical (CRIT)** | Security vulnerabilities, data loss risks, compliance blockers | Unsecured tokens, missing rate limiting, no health checks | Immediate - stop current work |
| **High (HIGH)** | Performance issues, type safety gaps, broken functionality | `any` types, N+1 queries, silent failures | Within current phase |
| **Medium (MED)** | Developer experience, optimization, non-blocking bugs | Missing indexes, incomplete error handling | Next phase |
| **Low (LOW)** | Documentation, nice-to-have features, cosmetic improvements | Swagger docs, frontend tests, UI polish | Final phase |

#### Prioritization Criteria

**1. Risk-Based Assessment**
Payment flows receive priority over admin dashboards. A vulnerability in payment processing affects all users and revenue. A bug in admin analytics affects only internal reporting.

```
Risk Score = (User Impact × Financial Impact × Security Risk) / Effort

High Risk: Payment processing, authentication, webhooks, refunds
Medium Risk: Subscriptions, usage billing, multi-currency
Lower Risk: Admin dashboards, reporting, analytics
```

**2. User Impact Analysis**
Features affecting all users get priority over admin-only features:

| Feature | Users Affected | Priority |
|---------|---------------|----------|
| Rate limiting on payments | All users | CRIT |
| Type safety in payments | All users (indirect) | HIGH |
| Admin dashboard performance | Admins only | MED |
| API documentation | Developers | LOW |

**3. Technical Debt Triage**
Technical debt is prioritized by its impact on future development:

| Debt Item | Impact | Priority |
|-----------|--------|----------|
| `any` types in payments | Silent failures, hard to debug | HIGH |
| `console.log` statements | No observability in production | HIGH |
| N+1 queries in admin | Slow page loads | HIGH |
| Missing database indexes | Performance degradation | MED |

**4. Test Coverage Gaps**
Untested critical paths are treated as high risk:

```
Coverage Priority:
1. PaymentsService (handles money) → 80%+ coverage
2. SubscriptionsService (recurring revenue) → 80%+ coverage
3. AuthService (security boundary) → 80%+ coverage
4. WebhooksService (async processing) → 80%+ coverage
5. Admin services (internal tools) → 60%+ coverage acceptable
```

**5. Production Readiness Checklist**
Features required for production deployment get priority:

| Requirement | Phase | Status |
|-------------|-------|--------|
| Health checks (/health, /ready) | Foundation | Required |
| Rate limiting | Foundation | Required |
| Structured logging | Foundation | Required |
| Test coverage 80%+ | Core Services | Required |
| API documentation | Polish | Nice-to-have |

#### Phased Approach

We follow **incremental phases** rather than big-bang releases:

```
Phase 1: Foundation (Weeks 1-2)
├── Testing infrastructure (Vitest, coverage)
├── Security hardening (rate limiting, crypto tokens)
├── Observability (health checks, logging)
└── Deliverable: Production-ready baseline

Phase 2: Core Services (Weeks 3-4)
├── Type safety (Stripe webhook types)
├── Service tests (Payments, Subscriptions)
├── Bug fixes (user suspension logic)
└── Deliverable: Tested, typed core

Phase 3: Webhooks & Performance (Weeks 5-6)
├── Webhook test coverage
├── Performance optimization (N+1, indexes)
├── Error handling standardization
└── Deliverable: Scalable, reliable system

Phase 4: Polish (Weeks 7-8)
├── API documentation (Swagger)
├── Frontend tests
├── E2E tests
└── Deliverable: Complete developer experience
```

**Key Principle:** Each phase delivers working, deployable code. We never hold a release for "phase 4" features.

#### Decision Flowchart

```
New Feature Request
        │
        ▼
Is it a security vulnerability? ──YES──► CRITICAL
        │ NO
        ▼
Does it affect payment processing? ──YES──► HIGH
        │ NO
        ▼
Is it blocking production deployment? ──YES──► HIGH
        │ NO
        ▼
Is it technical debt in core services? ──YES──► HIGH
        │ NO
        ▼
Is it a developer experience improvement? ──YES──► MEDIUM
        │ NO
        ▼
Is it documentation or testing? ──YES──► LOW
        │ NO
        ▼
  Evaluate user impact
```

#### Real-World Example

From the current project REQUIREMENTS.md:

```
CRIT-01: Add comprehensive unit test coverage (80%+ target)
CRIT-02: Implement API rate limiting middleware
CRIT-03: Create health check endpoints

HIGH-01: Replace `any` types with proper TypeScript interfaces
HIGH-02: Implement structured logging (replace console.log)
HIGH-03: Fix N+1 query issues in admin service

MED-01: Add database indexes for common queries
MED-02: Fix tax calculation silent failure

LOW-01: Add API documentation (OpenAPI/Swagger)
LOW-02: Implement request validation middleware
```

**Why this ordering?**
- CRITICAL: Can't deploy without tests, rate limiting, or health checks
- HIGH: Can deploy but will have operational pain (untyped, unobservable, slow)
- MEDIUM: Operational issues but not blocking
- LOW: Nice to have when core is solid

### 3.2 Payment Features Logical Flow

Payment processing follows a **secure, asynchronous flow** that never exposes sensitive card data to our servers while ensuring reliable transaction tracking.

#### One-Time Payment Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USER      │     │  FRONTEND   │     │   BACKEND   │     │    STRIPE   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  1. Enter amount  │                   │                   │
       │──────────────────>│                   │                   │
       │                   │  2. POST /payments/intent              │
       │                   │──────────────────>│                   │
       │                   │                   │  3. Create PaymentIntent
       │                   │                   │──────────────────>│
       │                   │                   │  4. Return client_secret
       │                   │                   │<──────────────────│
       │                   │  5. Return client_secret             │
       │                   │<──────────────────│                   │
       │  6. Show Stripe PaymentElement                    │
       │<──────────────────│                   │                   │
       │  7. Enter card details                  │                   │
       │──────────────────>│                   │                   │
       │                   │  8. stripe.confirmPayment()          │
       │                   │───────────────────────────────────────>│
       │                   │                   │                   │
       │                   │  9. Payment processed (3D Secure if needed)
       │                   │<───────────────────────────────────────│
       │  10. Show success │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │                   │  11. Webhook: payment_intent.succeeded
       │                   │                   │<──────────────────│
       │                   │                   │  12. Update database
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
```

**Key Steps:**

1. **Payment Intent Creation** - Backend creates Stripe PaymentIntent with amount, currency, and customer. Returns `client_secret` (not sensitive - safe for frontend).

```typescript
// payments.service.ts
async createPaymentIntent(dto: CreatePaymentDto) {
  const paymentIntent = await this.stripe.paymentIntents.create({
    amount: dto.amount,           // Amount in cents
    currency: dto.currency,     // 'usd', 'eur', etc.
    customer: user.stripeCustomerId,
    automatic_payment_methods: { enabled: true },
    metadata: { userId: user.id },
  });

  // Store pending payment in our database
  await this.prisma.payment.create({
    data: {
      stripePaymentIntentId: paymentIntent.id,
      amount: dto.amount,
      currency: dto.currency,
      status: 'requires_confirmation',
      userId: user.id,
    },
  });

  return { clientSecret: paymentIntent.client_secret };
}
```

2. **Client-Side Confirmation** - Frontend uses Stripe.js to confirm payment with card details. Card data never touches our server.

```typescript
// Frontend: React component
const { error, paymentIntent } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: `${window.location.origin}/payment/result`,
  },
});

if (error) {
  // Show error to user (card declined, insufficient funds, etc.)
} else if (paymentIntent.status === 'succeeded') {
  // Show success - webhook will update database
}
```

3. **Webhook Confirmation** - Stripe sends `payment_intent.succeeded` webhook. Backend updates database, sends receipt email.

```typescript
// webhooks.service.ts
async handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  await this.prisma.payment.update({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: { status: 'succeeded' },
  });

  await this.mailService.sendReceipt(paymentIntent);
}
```

#### Idempotency Protection

**Problem:** Network timeouts can cause duplicate charges if user retries.

**Solution:** Idempotency keys ensure same request processes once:

```typescript
// Backend generates idempotency key
const idempotencyKey = `payment-${user.id}-${Date.now()}`;

const paymentIntent = await this.stripe.paymentIntents.create(
  { /* ... */ },
  { idempotencyKey }  // Stripe deduplicates on this key
);

// Store key in Redis with TTL to prevent replays
await this.redis.setex(`idempotency:${idempotencyKey}`, 3600, 'processed');
```

#### Saved Payment Methods Flow

For returning customers, save payment methods for one-click payments:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USER      │     │  FRONTEND   │     │   BACKEND   │     │    STRIPE   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  1. "Save card"   │                   │                   │
       │──────────────────>│                   │                   │
       │                   │  2. POST /payment-methods/setup-intent
       │                   │──────────────────>│                   │
       │                   │                   │  3. Create SetupIntent
       │                   │                   │──────────────────>│
       │                   │  4. Return client_secret             │
       │                   │<──────────────────│                   │
       │  5. Show card input form              │                   │
       │<──────────────────│                   │                   │
       │  6. Enter card      │                   │                   │
       │──────────────────>│                   │                   │
       │                   │  7. stripe.confirmSetup()            │
       │                   │───────────────────────────────────────>│
       │                   │  8. PaymentMethod created            │
       │                   │<───────────────────────────────────────│
       │                   │  9. POST /payment-methods/save         │
       │                   │──────────────────>│                   │
       │                   │                   │  10. Attach to customer
       │                   │                   │──────────────────>│
       │  11. "Card saved" │                   │                   │
       │<──────────────────│                   │                   │
```

**Key Difference:** SetupIntent (saving) vs PaymentIntent (charging). SetupIntent creates a PaymentMethod without charging.

#### Error Handling Flow

Payment failures are categorized and handled appropriately:

| Error Type | Cause | User Message | Action |
|------------|-------|--------------|--------|
| **Card Error** | Declined, insufficient funds | "Your card was declined. Try a different card." | Allow retry with different card |
| **3D Secure Required** | Authentication needed | "Please complete authentication with your bank." | Redirect to 3D Secure |
| **Processing Error** | Stripe processing failure | "Payment processing failed. Please try again." | Auto-retry with exponential backoff |
| **Idempotency Conflict** | Duplicate request | "Payment is being processed." | Return existing payment status |

```typescript
// Error handling in service
async confirmPayment(paymentIntentId: string) {
  try {
    const paymentIntent = await this.stripe.paymentIntents.confirm(
      paymentIntentId
    );
    return { success: true, paymentIntent };
  } catch (error) {
    if (error.code === 'card_declined') {
      return {
        success: false,
        error: 'card_declined',
        message: 'Your card was declined. Try a different card.',
        retryable: true
      };
    }
    if (error.code === 'requires_action') {
      return {
        success: false,
        error: 'requires_3ds',
        clientSecret: error.paymentIntent.client_secret,
        retryable: true
      };
    }
    // Log unexpected errors
    this.logger.error('Payment confirmation failed', error);
    throw error; // Let global exception handler deal with it
  }
}
```

#### Refund Flow

Refunds support both full and partial amounts with reason tracking:

```
1. Admin/User requests refund
   POST /payments/:id/refund
   { amount?: number, reason: 'requested_by_customer' }

2. Backend validates payment exists and is refundable
   - Check payment.status === 'succeeded'
   - Check payment not already fully refunded

3. Create Stripe refund
   stripe.refunds.create({
     payment_intent: payment.stripePaymentIntentId,
     amount: refundAmount,  // Optional for partial
     reason: dto.reason,
   });

4. Update database
   - Create refund record
   - Update payment.refundedAmount
   - If fully refunded, update payment.status

5. Send confirmation email
   - Receipt with refund details
```

```typescript
async createRefund(paymentId: string, dto: CreateRefundDto) {
  const payment = await this.prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.status !== 'succeeded') {
    throw new BadRequestException('Payment not refundable');
  }

  const refundAmount = dto.amount || payment.amount;
  const availableAmount = payment.amount - payment.refundedAmount;

  if (refundAmount > availableAmount) {
    throw new BadRequestException('Refund amount exceeds available amount');
  }

  const refund = await this.stripe.refunds.create({
    payment_intent: payment.stripePaymentIntentId,
    amount: refundAmount,
    reason: dto.reason,
  });

  await this.prisma.$transaction([
    this.prisma.refund.create({
      data: {
        stripeRefundId: refund.id,
        paymentId: payment.id,
        amount: refundAmount,
        reason: dto.reason,
        status: refund.status,
      },
    }),
    this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: { increment: refundAmount },
        status: refundAmount === availableAmount ? 'refunded' : 'partially_refunded',
      },
    }),
  ]);

  return refund;
}
```

#### Payment Status Lifecycle

```
┌─────────────────┐
│  requires_confirmation  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   processing    │────►│     failed      │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│    succeeded    │────►│ requires_action │───► 3D Secure
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  partially_refunded  │◄──── refund
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    refunded     │◄──── full refund
└─────────────────┘
```

#### Multi-Currency Flow

Currency handling ensures transparent pricing across regions:

```
1. User selects country during registration
   - System suggests currency based on country
   - User can override (e.g., US user prefers EUR)

2. Currency stored in user profile
   - user.preferredCurrency: 'EUR'
   - user.country: 'US'

3. Display prices in preferred currency
   - Fetch exchange rate from Stripe API (cached 1 hour)
   - Convert USD base price to EUR
   - Show "€85.00 (~$90.00 USD)" for transparency

4. Create PaymentIntent in user's currency
   - Stripe handles conversion
   - Merchant receives USD (or configured settlement currency)

5. Receipt shows both currencies
   - Charged: €85.00 EUR
   - Approximate USD: $90.00 USD
```

#### Digital Wallets (Apple Pay / Google Pay)

Digital wallets appear automatically when available:

```
1. Frontend loads Stripe PaymentElement
   - Stripe detects device/browser capability
   - Apple Pay: Safari on macOS/iOS with Touch ID/Face ID
   - Google Pay: Chrome with saved payment methods

2. Wallet button appears automatically
   - No additional integration code needed
   - Same PaymentIntent flow as cards

3. User authenticates
   - Apple Pay: Touch ID / Face ID / password
   - Google Pay: Device unlock

4. Stripe processes payment
   - Same webhook flow as card payments
   - No special handling required
```

**Key Insight:** Digital wallets use the same PaymentIntent flow. The only difference is the authentication method (biometric vs card details).

### 3.3 Subscription Features Logical Flow

Subscriptions handle **recurring revenue** with complex lifecycle management including trials, proration, upgrades/downgrades, and self-service cancellation.

#### Subscription Creation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USER      │     │  FRONTEND   │     │   BACKEND   │     │    STRIPE   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  1. Select plan   │                   │                   │
       │──────────────────>│                   │                   │
       │                   │  2. POST /subscriptions              │
       │                   │  { planId, paymentMethodId }         │
       │                   │──────────────────>│                   │
       │                   │                   │  3. Validate plan exists
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
       │                   │                   │  4. Get or create customer
       │                   │                   │──────────────────>│
       │                   │                   │  5. Create subscription
       │                   │                   │  { customer, items: [{price}], 
       │                   │                   │    default_payment_method }
       │                   │                   │──────────────────>│
       │                   │                   │  6. Return subscription
       │                   │                   │<──────────────────│
       │                   │  7. Return subscription details      │
       │                   │<──────────────────│                   │
       │  8. Show confirmation                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │                   │  9. Webhook: invoice.paid
       │                   │                   │<──────────────────│
       │                   │                   │  10. Activate subscription
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
```

**Implementation:**

```typescript
async createSubscription(dto: CreateSubscriptionDto, user: User) {
  // Get Stripe customer ID (create if doesn't exist)
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await this.stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await this.usersService.updateStripeCustomerId(user.id, customerId);
  }

  // Get plan from database
  const plan = await this.prisma.plan.findUnique({
    where: { id: dto.planId },
  });

  if (!plan || !plan.stripePriceId) {
    throw new NotFoundException('Plan not found');
  }

  // Create Stripe subscription
  const subscription = await this.stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: plan.stripePriceId }],
    default_payment_method: dto.paymentMethodId,
    expand: ['latest_invoice.payment_intent'],
  });

  // Store in our database
  await this.prisma.subscription.create({
    data: {
      stripeSubscriptionId: subscription.id,
      userId: user.id,
      planId: plan.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  return subscription;
}
```

#### Trial Periods Flow

Trials allow users to experience value before paying:

```
1. Plan configuration
   - plan.trialDays: 14
   - plan.trialPriceId: price_trial (can be $0 or small amount)

2. Subscription creation with trial
   stripe.subscriptions.create({
     customer: customerId,
     items: [{ price: plan.stripePriceId }],
     trial_period_days: plan.trialDays,
     trial_settings: {
       end_behavior: { missing_payment_method: 'cancel' },
     },
   });

3. Trial status tracking
   - subscription.status: 'trialing'
   - subscription.trial_end: timestamp

4. Trial end reminders (webhook-driven)
   - 3 days before: Send "Trial ending soon" email
   - 1 day before: Send "Last chance" email
   - customer.subscription.trial_will_end webhook

5. Trial conversion or cancellation
   - Payment succeeds: status → 'active'
   - Payment fails: status → 'past_due' → 'canceled'
```

#### Proration Logic

Proration handles mid-cycle plan changes fairly:

```
Scenario: User upgrades from Basic ($10/month) to Pro ($30/month) on day 15

1. Calculate unused time on old plan
   - Days remaining: 15
   - Daily rate: $10 / 30 = $0.33/day
   - Credit: 15 × $0.33 = $5.00

2. Calculate remaining time on new plan
   - Days remaining: 15
   - Daily rate: $30 / 30 = $1.00/day
   - Charge: 15 × $1.00 = $15.00

3. Net charge
   - $15.00 (new) - $5.00 (credit) = $10.00 due now
   - Next invoice: $30.00 on normal cycle date

Stripe handles this automatically:
```

```typescript
async updateSubscription(subscriptionId: string, dto: UpdateSubscriptionDto) {
  const subscription = await this.prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  const newPlan = await this.prisma.plan.findUnique({
    where: { id: dto.newPlanId },
  });

  // Stripe handles proration automatically
  const updatedSubscription = await this.stripe.subscriptions.update(
    subscription.stripeSubscriptionId,
    {
      items: [{
        id: subscription.stripeSubscriptionItemId,
        price: newPlan.stripePriceId,
      }],
      proration_behavior: 'create_prorations', // or 'none', 'always_invoice'
    }
  );

  // Update our database
  await this.prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId: newPlan.id,
      status: updatedSubscription.status,
    },
  });

  return updatedSubscription;
}
```

**Proration Behaviors:**

| Behavior | Description | Use Case |
|------------|-------------|----------|
| `create_prorations` | Create proration items, invoice at cycle end | Default - fair billing |
| `always_invoice` | Invoice immediately for proration | User wants to pay now |
| `none` | No proration, changes effective next cycle | Annual plans, no mid-cycle changes |

#### Billing Cycles and Anchors

Billing cycles determine when invoices are generated:

```
Cycle Anchor: The day of month when billing occurs

Examples:
- User subscribes on March 15
- Monthly billing: 15th of each month
- Annual billing: March 15 each year

Cycle options:
1. Automatic (default): Day of first subscription
2. Fixed: Specific day (e.g., 1st of month for all customers)
3. Prorated to anchor: First period prorated to reach anchor date
```

```typescript
// Set billing cycle anchor to 1st of month
stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  billing_cycle_anchor: getFirstOfNextMonth(), // Unix timestamp
  proration_behavior: 'prorate', // Charge prorated amount to reach anchor
});
```

#### Invoice Generation

This system uses **internal invoicing** (not Stripe's invoice system):

```
Stripe Invoice (for payment collection)
├── Created automatically by Stripe
├── Contains line items from subscription
├── Payment attempted automatically
└── Webhook: invoice.paid or invoice.payment_failed

Internal Invoice (for record-keeping)
├── Generated by our system
├── PDF generated with Puppeteer
├── Stored in database
├── Sent via email
└── Available for download
```

**Why internal invoicing?**
- Full control over invoice design and branding
- Additional line items (usage, discounts, taxes)
- Custom business logic not supported by Stripe
- Multi-currency display requirements

```typescript
async generateInvoice(subscriptionId: string) {
  const subscription = await this.prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: true, plan: true },
  });

  // Get latest Stripe invoice
  const stripeInvoice = await this.stripe.invoices.retrieve(
    subscription.latestStripeInvoiceId
  );

  // Create internal invoice record
  const invoice = await this.prisma.invoice.create({
    data: {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      amount: stripeInvoice.amount_due,
      currency: stripeInvoice.currency,
      status: stripeInvoice.status,
      stripeInvoiceId: stripeInvoice.id,
      invoiceNumber: generateInvoiceNumber(),
      dueDate: new Date(stripeInvoice.due_date * 1000),
    },
  });

  // Generate PDF
  const pdfBuffer = await this.generatePdf(invoice);

  // Send email
  await this.mailService.sendInvoice(invoice, pdfBuffer);

  return invoice;
}
```

#### Payment Collection and Dunning

Automatic retries handle failed payments:

```
1. Invoice payment fails
   - Stripe automatically retries: Day 1, 3, 5, 7
   - subscription.status: 'past_due'

2. Dunning emails (webhook-driven)
   - Day 1: "Payment failed, retrying automatically"
   - Day 3: "Update your payment method"
   - Day 7: "Final notice before cancellation"

3. Subscription status changes
   - After final retry failure: status → 'unpaid' or 'canceled'
   - Depending on subscription settings

4. Recovery options
   - User updates payment method → retry immediately
   - Customer Portal for self-service
```

```typescript
// Handle failed payment webhook
async handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscription = await this.getSubscriptionByStripeId(
    invoice.subscription as string
  );

  // Update status
  await this.prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'past_due' },
  });

  // Send dunning email
  await this.mailService.sendPaymentFailedEmail(subscription.user, {
    attemptCount: invoice.attempt_count,
    nextPaymentAttempt: invoice.next_payment_attempt,
  });

  // If final attempt, notify admin
  if (invoice.attempt_count >= 4) {
    await this.notifyAdmin('Subscription payment failed after retries', {
      subscriptionId: subscription.id,
      userId: subscription.userId,
    });
  }
}
```

#### Cancellation Flow

Two cancellation modes support different business needs:

```
Immediate Cancellation:
- Subscription ends immediately
- Prorated refund issued (if applicable)
- User loses access immediately
- Use case: User requests refund, fraud detection

End-of-Period Cancellation:
- Subscription remains active until period end
- No refund issued
- User keeps access until end date
- Use case: User churning, voluntary downgrade
```

```typescript
async cancelSubscription(
  subscriptionId: string,
  dto: CancelSubscriptionDto
) {
  const subscription = await this.prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (dto.immediate) {
    // Immediate cancellation with refund
    await this.stripe.subscriptions.cancel(
      subscription.stripeSubscriptionId,
      { prorate: true } // Issue prorated refund
    );

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        cancelAtPeriodEnd: false,
      },
    });
  } else {
    // End-of-period cancellation
    await this.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'active', // Still active until period end
        cancelAtPeriodEnd: true,
      },
    });
  }
}
```

#### Subscription Status Lifecycle

```
┌─────────────────┐
│    trialing     │◄──── Trial period active
└────────┬────────┘
         │
         ▼ (trial ends, payment succeeds)
┌─────────────────┐
│     active      │◄──── Normal operation
└────────┬────────┘
         │
         ├──► Payment fails ──►┌─────────────┐
         │                     │  past_due   │
         │                     └──────┬──────┘
         │                            │
         │                            ├──► Payment succeeds ──► active
         │                            │
         │                            └──► Final retry fails
         │                                     │
         │                                     ▼
         │                              ┌─────────────┐
         │                              │   unpaid    │
         │                              │  (or canceled)
         │                              └─────────────┘
         │
         ├──► User cancels immediately ──► canceled
         │
         └──► User cancels at period end ──► active (until period end)
                                                    │
                                                    ▼
                                              canceled
```

#### Webhook Handling for Subscriptions

Critical webhook events for subscription management:

| Event | Trigger | Action |
|-------|---------|--------|
| `customer.subscription.created` | New subscription | Store in database, send welcome email |
| `customer.subscription.updated` | Plan change, status change | Update database, notify user |
| `customer.subscription.deleted` | Subscription ended | Mark canceled, revoke access |
| `invoice.paid` | Successful payment | Activate/renew subscription, send receipt |
| `invoice.payment_failed` | Failed payment | Update status, send dunning email |
| `customer.subscription.trial_will_end` | Trial ending (3 days) | Send trial ending reminder |

```typescript
// webhooks.service.ts
async handleWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.created':
      await this.handleSubscriptionCreated(event);
      break;
    case 'customer.subscription.updated':
      await this.handleSubscriptionUpdated(event);
      break;
    case 'invoice.paid':
      await this.handleInvoicePaid(event);
      break;
    case 'invoice.payment_failed':
      await this.handleInvoicePaymentFailed(event);
      break;
    // ... other events
  }
}
```

#### Customer Portal Integration

Stripe Customer Portal provides self-service subscription management:

```
1. User clicks "Manage Billing"
   Frontend: POST /customer-portal/session

2. Backend creates portal session
   stripe.billingPortal.sessions.create({
     customer: user.stripeCustomerId,
     return_url: 'https://app.example.com/account',
   });

3. Return portal URL to frontend
   { url: 'https://billing.stripe.com/session/...' }

4. Frontend redirects to Stripe-hosted portal
   - Update payment methods
   - Cancel subscription
   - View invoice history
   - Update billing information

5. User returns to app
   - Stripe redirects to return_url
   - Webhooks keep our database in sync
```

```typescript
async createPortalSession(user: User) {
  if (!user.stripeCustomerId) {
    throw new BadRequestException('No Stripe customer found');
  }

  const session = await this.stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${this.config.frontendUrl}/account/billing`,
  });

  return { url: session.url };
}
```

**Key Insight:** The Customer Portal reduces support burden by letting users self-serve common actions (update card, cancel, view invoices) while webhooks keep our system synchronized.

### 3.4 Usage-Based Billing Flow

Usage-based billing (metered billing) charges customers based on consumption rather than flat fees—ideal for APIs, storage, compute, or any measurable resource.

#### Metered Billing Setup

**Stripe Price Configuration:**

```typescript
// Create metered price
const price = await this.stripe.prices.create({
  unit_amount: 10, // $0.10 per unit
  currency: 'usd',
  recurring: {
    interval: 'month',
    usage_type: 'metered', // Key: metered vs licensed
    aggregate_usage: 'sum', // How to aggregate: sum, last_during_period, max
  },
  product_data: {
    name: 'API Calls',
  },
});
```

**Aggregation Modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| `sum` | Total of all usage records | API calls, bandwidth used |
| `last_during_period` | Most recent usage record | Seats, licenses (current count) |
| `last_ever` | Last record ever received | One-time setup fees |
| `max` | Highest usage in period | Concurrent users, peak storage |

#### Usage Recording Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USAGE     │     │   BACKEND   │     │    STRIPE   │     │   DATABASE   │
│   EVENT     │     │   SERVICE   │     │             │     │              │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  1. Usage occurs  │                   │                   │
       │  (API call, file   │                   │                   │
       │   upload, etc.)   │                   │                   │
       │──────────────────>│                   │                   │
       │                   │  2. Record usage  │                   │
       │                   │  stripe.usageRecords.create({        │
       │                   │    subscription_item: subItemId,     │
       │                   │    quantity: 1,                      │
       │                   │    timestamp: now(),                 │
       │                   │    action: 'increment'               │
       │                   │  })                                  │
       │                   │──────────────────>│                   │
       │                   │  3. Usage recorded │                  │
       │                   │<──────────────────│                   │
       │                   │  4. Store in DB    │                   │
       │                   │───────────────────────────────────────>│
       │                   │                   │                   │────┐
       │                   │                   │                   │    │
       │                   │                   │                   │<───┘
```

**Implementation:**

```typescript
@Injectable()
export class UsageService {
  constructor(
    private stripe: StripeService,
    private prisma: PrismaService,
  ) {}

  async recordUsage(
    subscriptionId: string,
    quantity: number,
    metadata?: Record<string, string>
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription || subscription.status !== 'active') {
      throw new BadRequestException('No active subscription found');
    }

    // Get Stripe subscription item ID
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );
    const subscriptionItemId = stripeSubscription.items.data[0].id;

    // Record usage in Stripe
    const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment', // or 'set' to override
      }
    );

    // Store in our database for reporting
    await this.prisma.usageRecord.create({
      data: {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        quantity,
        recordedAt: new Date(),
        stripeUsageRecordId: usageRecord.id,
        metadata,
      },
    });

    return usageRecord;
  }
}
```

**Usage Recording Patterns:**

```typescript
// Pattern 1: Real-time recording (for critical billing)
@Controller('api')
export class ApiController {
  @Post('process')
  async processRequest(@Body() dto: ProcessDto, @User() user: User) {
    // Process the request
    const result = await this.processingService.process(dto);

    // Record usage immediately
    await this.usageService.recordUsage(
      user.activeSubscriptionId,
      1, // 1 API call
      { endpoint: 'process', requestId: result.id }
    );

    return result;
  }
}

// Pattern 2: Batch recording (for high volume)
@Injectable()
export class UsageBatchService {
  private usageBuffer: Map<string, number> = new Map();

  async bufferUsage(userId: string, quantity: number) {
    const current = this.usageBuffer.get(userId) || 0;
    this.usageBuffer.set(userId, current + quantity);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async flushUsageBuffer() {
    for (const [userId, quantity] of this.usageBuffer.entries()) {
      await this.usageService.recordUsage(userId, quantity);
    }
    this.usageBuffer.clear();
  }
}

// Pattern 3: Async queue (for reliability)
@Injectable()
export class UsageQueueService {
  constructor(@InjectQueue('usage') private usageQueue: Queue) {}

  async queueUsageRecording(
    subscriptionId: string,
    quantity: number
  ) {
    await this.usageQueue.add('record-usage', {
      subscriptionId,
      quantity,
      timestamp: Date.now(),
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
    });
  }
}
```

#### Aggregation and Billing

Stripe automatically aggregates usage based on the price configuration:

```
Billing Cycle: Monthly
Aggregation: sum
Unit Price: $0.10

Daily Usage:
Day 1: 100 API calls
Day 2: 150 API calls
Day 3:  50 API calls
...
Day 30: 200 API calls

Total: 5,000 API calls
Invoice: 5,000 × $0.10 = $500.00
```

**Invoice Generation:**

```
1. Billing cycle ends
   - Stripe automatically generates invoice
   - Aggregates all usage records for the period

2. Invoice includes:
   - Base subscription (if any): $29.00
   - Usage: 5,000 API calls × $0.10 = $500.00
   - Total: $529.00

3. Payment attempted
   - Same flow as subscription billing
   - Webhook: invoice.paid or invoice.payment_failed

4. Usage reset
   - New billing period starts
   - Usage counter resets to 0
```

#### Billing Thresholds and Alerts

Alert customers before they hit limits:

```typescript
async checkUsageThresholds(subscriptionId: string) {
  const subscription = await this.prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { usageRecords: true, plan: true },
  });

  const currentUsage = subscription.usageRecords.reduce(
    (sum, record) => sum + record.quantity,
    0
  );

  const thresholds = [
    { percent: 50, sent: subscription.alert50Sent },
    { percent: 80, sent: subscription.alert80Sent },
    { percent: 100, sent: subscription.alert100Sent },
  ];

  for (const threshold of thresholds) {
    const thresholdAmount = subscription.plan.includedUsage * (threshold.percent / 100);

    if (currentUsage >= thresholdAmount && !threshold.sent) {
      await this.mailService.sendUsageAlert(subscription.user, {
        currentUsage,
        threshold: threshold.percent,
        planLimit: subscription.plan.includedUsage,
      });

      // Mark alert as sent
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: { [`alert${threshold.percent}Sent`]: true },
      });
    }
  }
}
```

#### Usage Reporting Dashboard

Users need visibility into their consumption:

```typescript
@Controller('usage')
export class UsageController {
  @Get('summary')
  async getUsageSummary(@User() user: User) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId: user.id, status: 'active' },
      include: { plan: true },
    });

    if (!subscription) {
      return { hasSubscription: false };
    }

    // Get current period usage
    const startOfPeriod = subscription.currentPeriodStart;
    const usageRecords = await this.prisma.usageRecord.findMany({
      where: {
        subscriptionId: subscription.id,
        recordedAt: { gte: startOfPeriod },
      },
    });

    const totalUsage = usageRecords.reduce((sum, r) => sum + r.quantity, 0);
    const includedUsage = subscription.plan.includedUsage || 0;
    const overageUsage = Math.max(0, totalUsage - includedUsage);

    // Daily breakdown for chart
    const dailyUsage = await this.prisma.usageRecord.groupBy({
      by: ['recordedAt'],
      where: {
        subscriptionId: subscription.id,
        recordedAt: { gte: startOfPeriod },
      },
      _sum: { quantity: true },
    });

    return {
      hasSubscription: true,
      planName: subscription.plan.name,
      currentPeriod: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
      },
      usage: {
        total: totalUsage,
        included: includedUsage,
        overage: overageUsage,
        percentage: Math.min(100, (totalUsage / includedUsage) * 100),
      },
      dailyBreakdown: dailyUsage.map(day => ({
        date: day.recordedAt,
        quantity: day._sum.quantity,
      })),
      projectedUsage: this.projectUsage(totalUsage, subscription.currentPeriodEnd),
    };
  }

  private projectUsage(currentUsage: number, periodEnd: Date): number {
    const daysElapsed = differenceInDays(new Date(), subscription.currentPeriodStart);
    const daysRemaining = differenceInDays(periodEnd, new Date());
    const dailyAverage = currentUsage / daysElapsed;
    return Math.round(currentUsage + (dailyAverage * daysRemaining));
  }
}
```

#### Overage Handling

Handle usage beyond plan limits:

```typescript
// Plan configuration
interface Plan {
  includedUsage: number;    // 10,000 API calls included
  overagePriceId: string;     // Stripe price for overage
  overageRate: number;      // $0.05 per overage unit
  hardLimit?: number;       // Optional: hard cutoff
}

// Check before processing
async validateUsageLimit(userId: string, requestedUsage: number) {
  const subscription = await this.getActiveSubscription(userId);
  const currentUsage = await this.getCurrentPeriodUsage(subscription.id);

  const projectedTotal = currentUsage + requestedUsage;

  // Hard limit check
  if (subscription.plan.hardLimit && projectedTotal > subscription.plan.hardLimit) {
    throw new UsageLimitExceededException({
      current: currentUsage,
      requested: requestedUsage,
      limit: subscription.plan.hardLimit,
      message: 'Usage limit exceeded. Upgrade your plan or contact sales.',
    });
  }

  // Soft limit warning
  if (projectedTotal > subscription.plan.includedUsage) {
    const overage = projectedTotal - subscription.plan.includedUsage;
    const estimatedCost = overage * subscription.plan.overageRate;

    // Log for monitoring
    this.logger.warn('Usage overage projected', {
      userId,
      currentUsage,
      projectedTotal,
      estimatedCost,
    });
  }

  return { allowed: true };
}
```

#### Prorated Usage for Mid-Cycle Subscriptions

When users subscribe mid-cycle, handle partial period billing:

```typescript
async createUsageSubscription(dto: CreateUsageSubscriptionDto, user: User) {
  const plan = await this.prisma.plan.findUnique({
    where: { id: dto.planId },
  });

  // Calculate prorated included usage
  const daysInMonth = 30;
  const daysRemaining = differenceInDays(
    endOfMonth(new Date()),
    new Date()
  );
  const proratedIncludedUsage = Math.round(
    (plan.includedUsage / daysInMonth) * daysRemaining
  );

  const subscription = await this.stripe.subscriptions.create({
    customer: user.stripeCustomerId,
    items: [{
      price: plan.stripePriceId,
      // No quantity for metered billing
    }],
    billing_cycle_anchor: endOfMonth(new Date()).getTime() / 1000,
    proration_behavior: 'prorate',
  });

  // Store prorated included usage
  await this.prisma.subscription.create({
    data: {
      stripeSubscriptionId: subscription.id,
      userId: user.id,
      planId: plan.id,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: endOfMonth(new Date()),
      proratedIncludedUsage, // Store for this partial period
    },
  });

  return subscription;
}
```

#### Webhook Events for Usage Billing

| Event | Trigger | Action |
|-------|---------|--------|
| `usage.record.created` | Usage recorded | Update internal metrics |
| `invoice.created` | Invoice generated | Include usage breakdown in email |
| `invoice.paid` | Usage paid | Reset usage counters, send receipt |
| `invoice.payment_failed` | Usage payment failed | Alert user, update status |

#### Usage-Based vs Seat-Based Billing

**When to use each model:**

| Model | Best For | Example |
|-------|----------|---------|
| **Metered** (usage-based) | Variable consumption | API calls, bandwidth, storage, compute time |
| **Licensed** (seat-based) | Fixed per-user pricing | SaaS seats, user licenses, fixed features |
| **Tiered** | Volume discounts | First 1K calls: $0.10, Next 9K: $0.08, 10K+: $0.05 |
| **Package** | Bundled pricing | 10K calls for $100, regardless of actual usage |

**Hybrid Models:**

```typescript
// Base fee + usage overage
const hybridPrice = await this.stripe.prices.create({
  currency: 'usd',
  recurring: { interval: 'month' },
  product_data: { name: 'Pro Plan' },
  // Base subscription
  unit_amount: 2900, // $29 base
});

const meteredPrice = await this.stripe.prices.create({
  currency: 'usd',
  recurring: {
    interval: 'month',
    usage_type: 'metered',
  },
  product_data: { name: 'API Calls' },
  unit_amount: 5, // $0.05 per call over included amount
});

// Create subscription with both items
await this.stripe.subscriptions.create({
  customer: customerId,
  items: [
    { price: hybridPrice.id },           // Base fee
    { price: meteredPrice.id },            // Usage
  ],
});
```

**Key Insight:** Usage-based billing requires robust tracking infrastructure. Every billable event must be recorded reliably. Use queues for high-volume scenarios, implement idempotency to prevent double-counting, and provide real-time visibility to users to prevent billing surprises.

### 3.5 Stripe Connect Flow

Stripe Connect enables **marketplace and platform payments** where the platform facilitates payments between customers and sellers (connected accounts), taking a fee for the service.

#### Connected Account Creation

**Account Types:**

| Type | Best For | Onboarding | Dashboard |
|------|----------|------------|-----------|
| **Standard** | Full control, custom onboarding | Platform builds UI | Stripe-hosted Dashboard |
| **Express** | Quick onboarding, less control | Stripe-hosted onboarding | Express Dashboard (branded) |
| **Custom** | White-label, full control | Platform builds everything | Platform builds dashboard |

**Express Account Creation (Recommended for most platforms):**

```typescript
async createConnectedAccount(user: User) {
  // Create Express account
  const account = await this.stripe.accounts.create({
    type: 'express',
    country: user.country || 'US',
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual', // or 'company'
    metadata: { userId: user.id },
  });

  // Store in database
  await this.prisma.connectedAccount.create({
    data: {
      userId: user.id,
      stripeAccountId: account.id,
      status: 'pending', // Until onboarding complete
      type: 'express',
      country: account.country,
    },
  });

  return account;
}
```

#### Onboarding Flow

Express onboarding uses Stripe-hosted flows with platform branding:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SELLER    │     │  PLATFORM   │     │    STRIPE   │     │   DATABASE   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  1. "Start selling" │                   │                   │
       │──────────────────>│                   │                   │
       │                   │  2. Create account │                   │
       │                   │  (if not exists)   │                   │
       │                   │────┐              │                   │
       │                   │    │              │                   │
       │                   │<───┘              │                   │
       │                   │  3. Create onboarding link            │
       │                   │  stripe.accountLinks.create({        │
       │                   │    account: accountId,                 │
       │                   │    refresh_url: platform.com/refresh,│
       │                   │    return_url: platform.com/return,  │
       │                   │    type: 'account_onboarding',       │
       │                   │  })                                  │
       │                   │──────────────────>│                   │
       │                   │  4. Return URL     │                  │
       │                   │<──────────────────│                   │
       │  5. Redirect to Stripe onboarding   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │  6. Complete onboarding               │                   │
       │  (Identity verification,              │                   │
       │   Bank account, TOS)                  │                   │
       │───────────────────────────────────────>│                   │
       │                   │                   │                   │
       │  7. Redirect back to platform         │                   │
       │<───────────────────────────────────────│                   │
       │                   │                   │                   │
       │                   │  8. Webhook: account.updated          │
       │                   │<──────────────────│                   │
       │                   │  9. Update status  │                   │
       │                   │───────────────────────────────────────>│
```

**Implementation:**

```typescript
async createOnboardingLink(user: User) {
  const connectedAccount = await this.prisma.connectedAccount.findUnique({
    where: { userId: user.id },
  });

  if (!connectedAccount) {
    throw new NotFoundException('Connected account not found');
  }

  const accountLink = await this.stripe.accountLinks.create({
    account: connectedAccount.stripeAccountId,
    refresh_url: `${this.config.frontendUrl}/seller/onboarding/refresh`,
    return_url: `${this.config.frontendUrl}/seller/onboarding/complete`,
    type: 'account_onboarding',
    collect: 'eventually_due', // Only required fields
  });

  return { url: accountLink.url };
}
```

#### Direct Charges

Direct charges place the payment on the connected account (seller is merchant of record):

```
Customer pays $100
├── $93.20 goes to Connected Account (seller)
├── $5.00 goes to Platform (5% fee)
├── $1.80 goes to Stripe (2.9% + $0.30)

Seller sees: $100 payment, $6.80 in fees
Platform sees: $5.00 revenue
```

```typescript
async createDirectCharge(
  dto: CreateDirectChargeDto,
  platformUser: User
) {
  const seller = await this.prisma.connectedAccount.findUnique({
    where: { userId: dto.sellerId },
  });

  if (!seller || seller.status !== 'active') {
    throw new BadRequestException('Seller not available');
  }

  // Calculate platform fee (5%)
  const platformFee = Math.round(dto.amount * 0.05);

  // Create PaymentIntent on connected account
  const paymentIntent = await this.stripe.paymentIntents.create({
    amount: dto.amount,
    currency: dto.currency,
    automatic_payment_methods: { enabled: true },
    application_fee_amount: platformFee, // Platform's cut
    transfer_data: {
      destination: seller.stripeAccountId,
    },
    on_behalf_of: seller.stripeAccountId, // Seller is merchant of record
    metadata: {
      platformUserId: platformUser.id,
      sellerId: seller.userId,
      orderId: dto.orderId,
    },
  });

  // Store in database
  await this.prisma.platformPayment.create({
    data: {
      stripePaymentIntentId: paymentIntent.id,
      amount: dto.amount,
      currency: dto.currency,
      platformFee,
      sellerAmount: dto.amount - platformFee,
      platformUserId: platformUser.id,
      sellerId: seller.userId,
      status: 'requires_confirmation',
    },
  });

  return { clientSecret: paymentIntent.client_secret };
}
```

#### Platform Fees

Fees can be structured in multiple ways:

```typescript
// Percentage fee
const platformFeePercent = 5; // 5%
const platformFee = Math.round(amount * (platformFeePercent / 100));

// Fixed fee
const platformFee = 100; // $1.00

// Hybrid: Percentage + Fixed
const platformFee = Math.round(amount * 0.05) + 30; // 5% + $0.30

// Tiered fees
function calculatePlatformFee(amount: number): number {
  if (amount < 1000) return Math.round(amount * 0.10);      // 10% under $10
  if (amount < 10000) return Math.round(amount * 0.07);     // 7% under $100
  return Math.round(amount * 0.05);                          // 5% over $100
}
```

#### Transfers and Payouts

Transfers move money from platform to connected accounts. Payouts are automatic transfers to seller's bank account.

```typescript
// Manual transfer (for refunds, adjustments, etc.)
async createTransfer(
  connectedAccountId: string,
  amount: number,
  reason: string
) {
  const transfer = await this.stripe.transfers.create({
    amount, // Amount in cents
    currency: 'usd',
    destination: connectedAccountId,
    description: reason,
  });

  await this.prisma.transfer.create({
    data: {
      stripeTransferId: transfer.id,
      connectedAccountId,
      amount,
      reason,
      status: 'pending',
    },
  });

  return transfer;
}

// Payout schedule (configured on connected account)
async configurePayoutSchedule(connectedAccountId: string) {
  await this.stripe.accounts.update(connectedAccountId, {
    settings: {
      payouts: {
        schedule: {
          interval: 'daily', // 'manual', 'weekly', 'monthly'
        },
      },
    },
  });
}
```

**Payout Flow:**

```
1. Payment succeeds
   - Funds held in Stripe for 2-7 days (rolling reserve)

2. Payout created automatically
   - Based on schedule (daily/weekly/monthly)
   - account.updated webhook: payouts_enabled: true

3. Funds transferred to seller's bank
   - payout.paid webhook
   - 1-2 business days to arrive

4. Seller sees in Express Dashboard
   - Available balance
   - Pending payouts
   - Payout history
```

#### Account Verification

KYC (Know Your Customer) requirements vary by country and account type:

```typescript
async checkAccountRequirements(connectedAccountId: string) {
  const account = await this.stripe.accounts.retrieve(connectedAccountId);

  const requirements = account.requirements;

  return {
    currentlyDue: requirements.currently_due,     // Required now
    eventuallyDue: requirements.eventually_due,     // Required later
    pastDue: requirements.past_due,                 // Overdue (payouts paused)
    pendingVerification: requirements.pending_verification,
    disabledReason: account.requirements.disabled_reason,
    chargesEnabled: account.charges_enabled,        // Can accept payments?
    payoutsEnabled: account.payouts_enabled,      // Can receive payouts?
  };
}
```

**Common Requirements:**

| Requirement | When Needed | Documents |
|-------------|-------------|-----------|
| Identity verification | Always | Government ID, SSN (US) |
| Business verification | Company accounts | EIN, business license |
| Bank account | Before first payout | Routing, account number |
| Address verification | Always | Utility bill, bank statement |

#### Dashboard Access

Express accounts get a branded dashboard:

```typescript
async createDashboardLoginLink(user: User) {
  const connectedAccount = await this.prisma.connectedAccount.findUnique({
    where: { userId: user.id },
  });

  if (!connectedAccount) {
    throw new NotFoundException('Connected account not found');
  }

  // Create login link for Express Dashboard
  const loginLink = await this.stripe.accounts.createLoginLink(
    connectedAccount.stripeAccountId
  );

  return { url: loginLink.url };
}
```

**Dashboard Features:**
- View balance and payouts
- See payment history
- Update bank account
- Download tax documents
- View and respond to disputes

#### Webhook Handling for Connect

Connect-specific webhook events:

| Event | Trigger | Action |
|-------|---------|--------|
| `account.updated` | Account status changes | Update verification status, enable/disable features |
| `account.application.deauthorized` | Seller disconnects | Disable seller, notify admin |
| `payout.paid` | Payout sent to bank | Update payout status, notify seller |
| `payout.failed` | Payout failed | Alert seller, update bank info |
| `capability.updated` | Feature capability changes | Enable/disable payment methods |

```typescript
// Handle Connect webhooks
async handleConnectWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      await this.handleAccountUpdated(account);
      break;
    }
    case 'payout.paid': {
      const payout = event.data.object as Stripe.Payout;
      await this.handlePayoutPaid(payout);
      break;
    }
    // ... other events
  }
}

async handleAccountUpdated(account: Stripe.Account) {
  const connectedAccount = await this.prisma.connectedAccount.findUnique({
    where: { stripeAccountId: account.id },
  });

  if (!connectedAccount) return;

  // Update status
  await this.prisma.connectedAccount.update({
    where: { id: connectedAccount.id },
    data: {
      status: account.charges_enabled ? 'active' : 'pending',
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirementsCurrentlyDue: account.requirements.currently_due,
      requirementsEventuallyDue: account.requirements.eventually_due,
    },
  });

  // Notify if status changed
  if (account.charges_enabled && !connectedAccount.chargesEnabled) {
    await this.mailService.sendSellerActivated(connectedAccount.userId);
  }
}
```

#### Multi-Party Payments

Split payments between multiple sellers:

```typescript
async createMultiPartyPayment(dto: MultiPartyPaymentDto) {
  // Calculate splits
  const totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);
  const platformFee = Math.round(totalAmount * 0.05);

  // Create transfer group
  const transferGroup = `order_${generateId()}`;

  // Create PaymentIntent (charged to platform)
  const paymentIntent = await this.stripe.paymentIntents.create({
    amount: totalAmount,
    currency: dto.currency,
    transfer_group: transferGroup,
    metadata: { transferGroup },
  });

  // Create transfers to each seller
  for (const item of dto.items) {
    const sellerFee = Math.round(item.amount * 0.05); // 5% per seller
    const sellerAmount = item.amount - sellerFee;

    await this.stripe.transfers.create({
      amount: sellerAmount,
      currency: dto.currency,
      destination: item.sellerStripeAccountId,
      transfer_group: transferGroup,
      metadata: {
        orderItemId: item.id,
        sellerId: item.sellerId,
      },
    });
  }

  return paymentIntent;
}
```

#### Compliance and Tax

**Platform Responsibilities:**

```typescript
// Tax reporting settings
async configureTaxSettings(connectedAccountId: string) {
  await this.stripe.accounts.update(connectedAccountId, {
    settings: {
      tax: {
        // Platform handles tax calculation
        liability: 'platform',
      },
    },
  });
}

// 1099-K threshold monitoring
async check1099Threshold(userId: string) {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const totalVolume = await this.prisma.platformPayment.aggregate({
    where: {
      sellerId: userId,
      status: 'succeeded',
      createdAt: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    _sum: { amount: true },
  });

  const threshold = 20000; // $20,000 AND 200 transactions
  const transactionCount = await this.prisma.platformPayment.count({
    where: {
      sellerId: userId,
      status: 'succeeded',
      createdAt: { gte: startOfYear, lte: endOfYear },
    },
  });

  return {
    totalVolume: totalVolume._sum.amount || 0,
    transactionCount,
    thresholdMet: totalVolume._sum.amount >= threshold && transactionCount >= 200,
  };
}
```

**International Considerations:**

| Consideration | Implementation |
|---------------|----------------|
| Currency | Support seller's local currency |
| Tax IDs | Collect VAT/GST numbers for B2B |
| Payout schedules | Vary by country (2-7 days typical) |
| Compliance | Platform responsible for seller verification |

**Key Insight:** Stripe Connect shifts liability to the platform for seller verification and compliance. The platform must ensure sellers complete onboarding and meet KYC requirements before they can accept payments.

### 3.6 Multi-Currency Support Flow

Multi-currency support enables global commerce by allowing customers to pay in their local currency while merchants receive funds in their preferred settlement currency.

#### Currency Detection

**Detection Strategy:**

```typescript
// Multi-layer detection with user preference override
async detectUserCurrency(req: Request, user?: User): Promise<Currency> {
  // Priority 1: User's saved preference
  if (user?.preferredCurrency) {
    return user.preferredCurrency;
  }

  // Priority 2: Country from user profile
  if (user?.country) {
    return this.getCurrencyForCountry(user.country);
  }

  // Priority 3: IP geolocation (for anonymous users)
  const clientIp = req.ip;
  const countryCode = await this.geoIpService.getCountryCode(clientIp);
  if (countryCode) {
    return this.getCurrencyForCountry(countryCode);
  }

  // Fallback: Default currency
  return 'USD';
}

// Country to currency mapping
private getCurrencyForCountry(countryCode: string): Currency {
  const mapping: Record<string, Currency> = {
    'US': 'USD',
    'GB': 'GBP',
    'DE': 'EUR',
    'FR': 'EUR',
    'JP': 'JPY',
    'AU': 'AUD',
    'CA': 'CAD',
    // ... 50+ countries
  };
  return mapping[countryCode] || 'USD';
}
```

**Country-Currency Mapping:**

| Country | Currency | Symbol | Locale |
|---------|----------|--------|--------|
| United States | USD | $ | en-US |
| United Kingdom | GBP | £ | en-GB |
| Germany | EUR | € | de-DE |
| Japan | JPY | ¥ | ja-JP |
| Australia | AUD | A$ | en-AU |
| Canada | CAD | C$ | en-CA |

#### Exchange Rates

**Stripe Exchange Rates API:**

```typescript
@Injectable()
export class CurrencyService {
  private exchangeRates: Map<string, number> = new Map();
  private lastUpdate: Date;

  constructor(
    private stripe: StripeService,
    private redis: RedisService,
  ) {}

  async updateExchangeRates(): Promise<void> {
    try {
      // Fetch from Stripe
      const rates = await this.stripe.exchangeRates.list();

      // Store in Redis with 1-hour TTL
      for (const rate of rates.data) {
        await this.redis.hset('exchange_rates', rate.currency, rate.rates['USD']);
      }

      await this.redis.set('exchange_rates:last_update', Date.now());
      this.lastUpdate = new Date();
    } catch (error) {
      this.logger.error('Failed to update exchange rates', error);
      // Fallback: Use cached rates or static fallback
    }
  }

  async convertAmount(
    amount: number,
    from: Currency,
    to: Currency
  ): Promise<number> {
    if (from === to) return amount;

    const rates = await this.redis.hgetall('exchange_rates');
    const fromRate = parseFloat(rates[from] || '1');
    const toRate = parseFloat(rates[to] || '1');

    // Convert to USD base, then to target
    const usdAmount = amount / fromRate;
    const convertedAmount = usdAmount * toRate;

    return Math.round(convertedAmount); // Stripe amounts in cents
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduledRateUpdate(): Promise<void> {
    await this.updateExchangeRates();
  }
}
```

**Rate Caching Strategy:**

```
Update Frequency: Daily at midnight UTC
Cache Duration: 24 hours
Fallback: Previous day's rates (up to 7 days)
Emergency Fallback: Static rates (updated quarterly)
```

#### Price Display

**Dual Currency Display:**

```typescript
// Format price with transparency
function formatPrice(
  amount: number,
  currency: Currency,
  userCurrency: Currency,
  exchangeRate: number
): PriceDisplay {
  // Primary: User's preferred currency
  const primaryAmount = convertAmount(amount, currency, userCurrency, exchangeRate);

  // Secondary: Original currency (for transparency)
  const showSecondary = currency !== userCurrency;

  return {
    primary: {
      amount: primaryAmount,
      currency: userCurrency,
      formatted: formatCurrency(primaryAmount, userCurrency),
    },
    secondary: showSecondary ? {
      amount,
      currency,
      formatted: formatCurrency(amount, currency),
    } : null,
    exchangeRate: showSecondary ? exchangeRate : null,
  };
}

// Example output:
// User in Germany viewing US-priced product:
// "€85.00 (~$90.00 USD)"
// "Exchange rate: 1 USD = 0.94 EUR"
```

**Formatting Rules:**

| Currency | Format | Example |
|----------|--------|---------|
| USD | $X.XX | $90.00 |
| EUR | X.XX € | 85.00 € |
| GBP | £X.XX | £75.00 |
| JPY | ¥X | ¥13,500 |
| AUD | A$X.XX | A$140.00 |
| CAD | C$X.XX | C$125.00 |

#### Payment in Local Currency

**Creating Multi-Currency PaymentIntent:**

```typescript
async createPaymentIntent(
  dto: CreatePaymentDto,
  user: User
): Promise<PaymentIntentResponse> {
  // Get user's preferred currency
  const currency = user.preferredCurrency || 'USD';

  // Convert amount if needed
  let amount = dto.amount;
  if (dto.currency && dto.currency !== currency) {
    amount = await this.currencyService.convertAmount(
      dto.amount,
      dto.currency,
      currency
    );
  }

  const paymentIntent = await this.stripe.paymentIntents.create({
    amount,
    currency, // Charge in user's currency
    customer: user.stripeCustomerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      originalAmount: dto.amount,
      originalCurrency: dto.currency,
      userCurrency: currency,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    currency,
    amount,
    exchangeRate: amount / dto.amount,
  };
}
```

**Settlement Behavior:**

```
Customer pays: €85.00 EUR
Stripe converts: €85.00 → $90.00 USD (at Stripe's rate)
Merchant receives: $90.00 USD (minus Stripe fees)

Key: Customer sees EUR, merchant receives USD automatically
```

#### Currency Switching

**Allow users to change currency:**

```typescript
@Controller('currency')
export class CurrencyController {
  @Get()
  async getSupportedCurrencies(): Promise<CurrencyInfo[]> {
    return [
      { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
      { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
      { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
    ];
  }

  @Patch('preference')
  @UseGuards(JwtAuthGuard)
  async updateCurrencyPreference(
    @Body() dto: UpdateCurrencyPreferenceDto,
    @User() user: User
  ) {
    // Validate currency is supported
    if (!this.isSupportedCurrency(dto.currency)) {
      throw new BadRequestException('Currency not supported');
    }

    // Update user preference
    await this.prisma.user.update({
      where: { id: user.id },
      data: { preferredCurrency: dto.currency },
    });

    // Clear any cached prices
    await this.cacheService.del(`user_prices:${user.id}`);

    return { success: true, currency: dto.currency };
  }
}
```

**UI Implementation:**

```typescript
// Currency selector component
export function CurrencySelector() {
  const { preferredCurrency, setPreferredCurrency } = useCurrency();
  const { data: currencies } = useGetSupportedCurrenciesQuery();

  return (
    <Select
      value={preferredCurrency}
      onChange={(value) => setPreferredCurrency(value)}
    >
      {currencies?.map((currency) => (
        <Option key={currency.code} value={currency.code}>
          {currency.flag} {currency.code} - {currency.name}
        </Option>
      ))}
    </Select>
  );
}
```

#### Rounding Rules

**Handling Fractional Cents:**

```typescript
// Stripe requires integer amounts (cents)
// Different currencies have different precision

function roundForCurrency(amount: number, currency: Currency): number {
  // Zero-decimal currencies (no cents)
  const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND'];

  if (zeroDecimalCurrencies.includes(currency)) {
    return Math.round(amount); // Round to whole unit
  }

  // Standard currencies: round to cents
  return Math.round(amount);
}

// Conversion with rounding
async function convertWithRounding(
  amount: number,
  from: Currency,
  to: Currency
): Promise<number> {
  const rate = await getExchangeRate(from, to);
  const converted = amount * rate;
  return roundForCurrency(converted, to);
}
```

**Rounding Strategies:**

| Strategy | Use Case | Example |
|----------|----------|---------|
| **Round half up** | Default | $10.005 → $10.01 |
| **Round down** | Discounts | $10.999 → $10.99 |
| **Banker's rounding** | Financial | $10.005 → $10.00 (even) |

#### Tax in Multi-Currency

**VAT Calculation with Currency Conversion:**

```typescript
async calculateTax(
  amount: number,
  currency: Currency,
  customerAddress: Address
): Promise<TaxCalculation> {
  // Calculate tax in customer's currency
  const taxRate = await this.taxService.getTaxRate(customerAddress);
  const taxAmount = Math.round(amount * taxRate);

  // Total in customer's currency
  const total = amount + taxAmount;

  return {
    subtotal: { amount, currency },
    tax: { amount: taxAmount, currency, rate: taxRate },
    total: { amount: total, currency },
  };
}

// Example:
// Product: €100.00
// VAT (20%): €20.00
// Total: €120.00
// Stripe receives: amount=12000, currency='EUR'
```

**Tax ID Validation:**

```typescript
async validateTaxId(taxId: string, country: string): Promise<ValidationResult> {
  try {
    const result = await this.stripe.taxIds.create({
      type: getTaxIdType(country), // 'eu_vat', 'gb_vat', etc.
      value: taxId,
    }, {
      stripeAccount: connectedAccountId, // If Connect
    });

    return {
      valid: result.verification.status === 'verified',
      status: result.verification.status,
      message: result.verification.verified_address,
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

#### Reporting Across Currencies

**Consolidated Reporting:**

```typescript
async generateRevenueReport(
  startDate: Date,
  endDate: Date
): Promise<RevenueReport> {
  // Get all payments in period
  const payments = await this.prisma.payment.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      status: 'succeeded',
    },
  });

  // Group by currency
  const byCurrency = payments.reduce((acc, payment) => {
    const currency = payment.currency;
    if (!acc[currency]) {
      acc[currency] = { amount: 0, count: 0 };
    }
    acc[currency].amount += payment.amount;
    acc[currency].count += 1;
    return acc;
  }, {} as Record<Currency, { amount: number; count: number }>);

  // Convert all to USD for total
  let totalUsd = 0;
  for (const [currency, data] of Object.entries(byCurrency)) {
    const usdAmount = await this.currencyService.convertAmount(
      data.amount,
      currency as Currency,
      'USD'
    );
    totalUsd += usdAmount;
  }

  return {
    period: { start: startDate, end: endDate },
    byCurrency,
    totalUsd,
    exchangeRates: await this.getExchangeRates(),
  };
}
```

#### Supported Currencies

**Selection Criteria:**

| Currency | Support | Reason |
|----------|---------|--------|
| USD | ✅ | Primary market, settlement currency |
| EUR | ✅ | Large market, SEPA support |
| GBP | ✅ | UK market, Stripe support |
| CAD | ✅ | North American expansion |
| AUD | ✅ | APAC market |
| JPY | ✅ | Major Asian market |
| CHF | ❌ | Low volume, complexity |
| CNY | ❌ | Regulatory restrictions |

**Adding New Currencies:**

```typescript
// Criteria for adding currencies:
// 1. Stripe support (payment methods available)
// 2. Sufficient transaction volume
// 3. Legal/compliance requirements met
// 4. Tax calculation support

interface CurrencyRequirement {
  code: string;
  stripeSupport: boolean;
  volumeThreshold: number; // Monthly transactions
  complianceStatus: 'approved' | 'pending' | 'blocked';
}
```

**Key Insight:** Multi-currency support increases conversion rates by 10-20% in international markets. The complexity is in maintaining accurate exchange rates, handling rounding consistently, and providing transparency to users about conversion rates and fees.

---

## 4. Data Flow Patterns

### 4.1 Payment Intent Flow

The PaymentIntent flow represents the **complete lifecycle of a payment** from user intent to confirmed transaction, ensuring security, reliability, and auditability.

#### Complete Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    USER     │     │  FRONTEND   │     │   BACKEND   │     │    STRIPE   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  1. Click "Pay"   │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │  2. POST /payments/intent              │
       │                   │  Headers: Authorization: Bearer {jwt} │
       │                   │  Body: { amount: 5000, currency: 'usd' }
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │                   │  3. Validate JWT
       │                   │                   │  4. Validate amount > 0
       │                   │                   │  5. Check rate limits
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
       │                   │                   │                   │
       │                   │                   │  6. Get/create customer
       │                   │                   │──────────────────>│
       │                   │                   │  7. Return customer ID
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │                   │                   │  8. Create PaymentIntent
       │                   │                   │  stripe.paymentIntents.create({
       │                   │                   │    amount: 5000,
       │                   │                   │    currency: 'usd',
       │                   │                   │    customer: 'cus_xxx',
       │                   │                   │    metadata: { userId: '123' },
       │                   │                   │    idempotencyKey: 'key-xxx'
       │                   │                   │  })
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │                   │  9. Return PaymentIntent
       │                   │                   │  { id: 'pi_xxx',
       │                   │                   │    client_secret: 'pi_xxx_secret_xxx',
       │                   │                   │    status: 'requires_confirmation' }
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │                   │  10. Return client_secret              │
       │                   │  11. Store paymentId in state          │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │  12. Mount PaymentElement               │                   │
       │  (Stripe.js loads secure iframe)        │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │  13. Enter card details               │                   │
       │  (Card data never touches our servers)  │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │  14. stripe.confirmPayment({           │
       │                   │    elements,
       │                   │    confirmParams: {
       │                   │      return_url: '/payment/result'
       │                   │    }
       │                   │  })
       │                   │───────────────────────────────────────>│
       │                   │                   │                   │
       │                   │  15. [If 3D Secure required]            │
       │                   │  Redirect to bank authentication      │
       │                   │<───────────────────────────────────────│
       │                   │                   │                   │
       │  16. Complete authentication          │                   │
       │───────────────────────────────────────>│                   │
       │                   │                   │                   │
       │                   │  17. Return to return_url               │
       │                   │  ?payment_intent=pi_xxx&status=succeeded
       │                   │<───────────────────────────────────────│
       │                   │                   │                   │
       │  18. Show success screen              │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │                   │  19. Webhook: payment_intent.succeeded
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │                   │                   │  20. Verify signature
       │                   │                   │  21. Update database
       │                   │                   │  { status: 'succeeded',
       │                   │                   │    paidAt: new Date() }
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
       │                   │                   │                   │
       │                   │                   │  22. Send receipt email
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
       │                   │                   │                   │
       │                   │                   │  23. Update inventory
       │                   │                   │  (if applicable)
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
```

#### Step 1: Frontend Request

**User initiates payment:**

```typescript
// Frontend: Payment form component
export function PaymentForm({ amount, currency }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState('');

  // Get client secret on mount
  useEffect(() => {
    api.post('/payments/intent', { amount, currency })
      .then(res => setClientSecret(res.data.clientSecret));
  }, [amount, currency]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/result`,
      },
    });

    if (error) {
      // Show error to user
      toast.error(error.message);
    }
    // Success handled by redirect to return_url
  };

  return (
    <form onSubmit={handleSubmit}>
      {clientSecret && (
        <PaymentElement options={{ layout: 'tabs' }} />
      )}
      <button type="submit" disabled={!stripe}>Pay</button>
    </form>
  );
}
```

#### Step 2: Backend Validation

**Multi-layer validation before creating PaymentIntent:**

```typescript
@Controller('payments')
export class PaymentsController {
  @Post('intent')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  async createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
    @User() user: User
  ) {
    // Validation 1: Amount bounds
    if (dto.amount < 50) { // Minimum $0.50
      throw new BadRequestException('Amount below minimum');
    }
    if (dto.amount > 1000000) { // Maximum $10,000
      throw new BadRequestException('Amount exceeds maximum');
    }

    // Validation 2: Currency support
    if (!this.isSupportedCurrency(dto.currency)) {
      throw new BadRequestException('Currency not supported');
    }

    // Validation 3: User limits
    const dailyTotal = await this.paymentsService.getDailyTotal(user.id);
    if (dailyTotal + dto.amount > user.dailyLimit) {
      throw new ForbiddenException('Daily limit exceeded');
    }

    // Validation 4: Rate limiting (handled by guard)
    // @Throttle(10, 60) - 10 requests per minute

    return this.paymentsService.createPaymentIntent(dto, user);
  }
}
```

#### Step 3: Stripe Creation

**Creating the PaymentIntent with proper metadata:**

```typescript
async createPaymentIntent(
  dto: CreatePaymentIntentDto,
  user: User
): Promise<PaymentIntentResponse> {
  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await this.usersService.updateStripeCustomerId(user.id, customerId);
  }

  // Generate idempotency key
  const idempotencyKey = `payment-${user.id}-${Date.now()}`;

  // Create PaymentIntent
  const paymentIntent = await this.stripe.paymentIntents.create({
    amount: dto.amount,
    currency: dto.currency,
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      userId: user.id,
      orderId: dto.orderId,
      idempotencyKey,
    },
    receipt_email: user.email,
    description: dto.description || `Payment for ${dto.orderId}`,
  }, {
    idempotencyKey, // Prevent duplicate charges
  });

  // Store in database
  await this.prisma.payment.create({
    data: {
      stripePaymentIntentId: paymentIntent.id,
      userId: user.id,
      amount: dto.amount,
      currency: dto.currency,
      status: 'requires_confirmation',
      metadata: dto.metadata,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}
```

#### Step 4: Client Secret

**The client_secret is safe to expose to the frontend:**

```
Client Secret: pi_3Oxxx..._secret_xxx
├── Not sensitive (no card data)
├── Required for Stripe.js to confirm payment
├── Single-use (expires after confirmation)
└── Scoped to specific PaymentIntent

Security: Even if leaked, attacker can only confirm
this specific payment, not create new charges.
```

#### Step 5: Stripe Elements

**Secure payment form mounting:**

```typescript
// Frontend: Stripe Elements provider
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY);

export function PaymentPage({ clientSecret }) {
  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0570de',
        colorBackground: '#ffffff',
        colorText: '#30313d',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm />
    </Elements>
  );
}
```

**PCI Compliance:**
- Card data enters Stripe's iframe (stripe.com domain)
- Our servers never see raw card numbers
- SAQ A compliance (simplest PCI level)

#### Step 6: Confirmation

**Stripe.js handles the confirmation:**

```typescript
const { error, paymentIntent } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: `${window.location.origin}/payment/result`,
    receipt_email: user.email,
    payment_method_data: {
      billing_details: {
        name: user.name,
        email: user.email,
      },
    },
  },
  redirect: 'if_required', // Handle 3D Secure automatically
});

// Possible outcomes:
// 1. Immediate success: paymentIntent.status === 'succeeded'
// 2. Requires action: Redirect to 3D Secure
// 3. Error: Card declined, insufficient funds, etc.
```

#### Step 7: 3D Secure Handling

**Strong Customer Authentication (SCA) for EU/UK:**

```
Scenario: EU customer with card requiring 3D Secure

1. confirmPayment() called
2. Stripe detects 3D Secure required
3. Stripe returns requires_action status
4. Stripe.js automatically redirects to bank's 3D Secure page
5. Customer authenticates (SMS code, app, etc.)
6. Bank redirects back to return_url
7. Stripe processes the payment
8. PaymentIntent status: succeeded
```

```typescript
// Handle return from 3D Secure
export function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const paymentIntentId = searchParams.get('payment_intent');
  const status = searchParams.get('payment_intent_client_secret');

  useEffect(() => {
    if (paymentIntentId) {
      // Verify payment status with backend
      api.get(`/payments/${paymentIntentId}/status`)
        .then(res => {
          if (res.data.status === 'succeeded') {
            toast.success('Payment successful!');
            navigate('/success');
          } else {
            toast.error('Payment failed');
            navigate('/retry');
          }
        });
    }
  }, [paymentIntentId]);

  return <LoadingSpinner />;
}
```

#### Step 8: Webhook Confirmation

**Asynchronous confirmation via webhook:**

```typescript
// webhooks.controller.ts
@Post('webhook')
async handleWebhook(
  @Headers('stripe-signature') signature: string,
  @Body() rawBody: Buffer
) {
  // Verify webhook signature
  const event = this.stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  // Route to appropriate handler
  switch (event.type) {
    case 'payment_intent.succeeded':
      await this.handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await this.handlePaymentFailure(event.data.object);
      break;
    // ... other events
  }

  return { received: true };
}
```

#### Step 9: Database Update

**Idempotent database updates:**

```typescript
async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const payment = await this.prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  });

  if (!payment) {
    this.logger.error('Payment not found', { paymentIntentId: paymentIntent.id });
    return;
  }

  // Idempotent update - safe to retry
  await this.prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'succeeded',
      paidAt: new Date(),
      paymentMethodId: paymentIntent.payment_method as string,
      receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
    },
  });

  // Update related records
  await this.prisma.order.update({
    where: { id: payment.orderId },
    data: { status: 'paid' },
  });
}
```

#### Step 10: Receipt and Notification

**Post-payment actions:**

```typescript
async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  // 1. Update database (shown above)

  // 2. Send receipt email
  const user = await this.usersService.findById(payment.userId);
  await this.mailService.sendReceipt({
    to: user.email,
    amount: payment.amount,
    currency: payment.currency,
    receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
    orderId: payment.orderId,
  });

  // 3. Update inventory (if applicable)
  if (payment.orderId) {
    await this.inventoryService.reserveItems(payment.orderId);
  }

  // 4. Trigger integrations (analytics, CRM, etc.)
  await this.analytics.track('Payment Succeeded', {
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
  });

  // 5. Clear any pending flags
  await this.cache.del(`payment_pending:${payment.id}`);
}
```

**Key Insight:** The PaymentIntent flow separates concerns: frontend handles UI/UX, backend handles business logic, Stripe handles payment processing, and webhooks ensure eventual consistency. This architecture is resilient to network failures and supports complex scenarios like 3D Secure.

### 4.2 Webhook Processing Flow

Webhooks provide **asynchronous event delivery** from Stripe, ensuring our system stays synchronized with payment state changes even when the user isn't actively interacting with our application.

#### Complete Webhook Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    STRIPE   │     │   BACKEND   │     │  DATABASE   │     │  SIDE EFFECTS │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  1. Event occurs  │                   │                   │
       │  (payment succeeds,                   │                   │
       │   subscription renews, etc.)          │                   │
       │                   │                   │                   │
       │  2. POST /stripe/webhook              │                   │
       │  Headers:
       │    Stripe-Signature: t=xxx,v1=yyy
       │  Body: { id: 'evt_xxx', type: 'payment_intent.succeeded', ... }
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │  3. Verify signature
       │                   │  stripe.webhooks.constructEvent()
       │                   │  - Extract timestamp
       │                   │  - Compute expected signature
       │                   │  - Compare with Stripe-Signature header
       │                   │────┐              │                   │
       │                   │    │              │                   │
       │                   │<───┘              │                   │
       │                   │                   │                   │
       │                   │  4. Check idempotency
       │                   │  - Check if event ID already processed
       │                   │  - Store in Redis with TTL
       │                   │────┐              │                   │
       │                   │    │              │                   │
       │                   │<───┘              │                   │
       │                   │                   │                   │
       │                   │  5. Parse event
       │                   │  - Validate event structure
       │                   │  - Type cast to specific event type
       │                   │────┐              │                   │
       │                   │    │              │                   │
       │                   │<───┘              │                   │
       │                   │                   │                   │
       │                   │  6. Route to handler
       │                   │  switch (event.type) {
       │                   │    case 'payment_intent.succeeded':
       │                   │      return this.handlePaymentSuccess(event);
       │                   │    case 'invoice.paid':
       │                   │      return this.handleInvoicePaid(event);
       │                   │    // ... etc
       │                   │  }
       │                   │                   │                   │
       │                   │  7. Execute handler
       │                   │  - Update database
       │                   │  - Trigger side effects
       │                   │  - Log processing
       │                   │                   │                   │
       │                   │  8. Update database
       │                   │──────────────────>│                   │
       │                   │                   │  - Update payment status
       │                   │                   │  - Create/update records
       │                   │                   │  - Mark event processed
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
       │                   │                   │                   │
       │                   │  9. Trigger side effects
       │                   │───────────────────────────────────────>│
       │                   │                   │                   │  - Send email
       │                   │                   │                   │  - Update inventory
       │                   │                   │                   │  - Notify integrations
       │                   │                   │                   │────┐
       │                   │                   │                   │    │
       │                   │                   │                   │<───┘
       │                   │                   │                   │
       │                   │  10. Return 200 OK │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │  [If error]       │                   │                   │
       │                   │  11. Return 4xx/5xx                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │  12. Retry with exponential backoff   │                   │
       │──────────────────>│                   │                   │
       │  (Stripe retries up to 3 days)        │                   │
```

#### Step 1: Webhook Endpoint

**Receiving events from Stripe:**

```typescript
@Controller('stripe')
export class WebhooksController {
  constructor(
    private webhooksService: WebhooksService,
    private config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Body() rawBody: Buffer,
    @Res() res: Response
  ) {
    // Must use raw body for signature verification
    // (NestJS body parser should not parse this)

    try {
      await this.webhooksService.processWebhook(signature, rawBody);
      return res.json({ received: true });
    } catch (error) {
      this.logger.error('Webhook processing failed', error);
      // Return error to trigger Stripe retry
      throw new BadRequestException(error.message);
    }
  }
}
```

**Raw Body Configuration:**

```typescript
// main.ts - Disable body parsing for webhook route
app.use('/stripe/webhook', bodyParser.raw({ type: 'application/json' }));
app.use(bodyParser.json()); // Regular JSON parsing for other routes
```

#### Step 2: Signature Verification

**Critical security step:**

```typescript
async processWebhook(signature: string, rawBody: Buffer): Promise<void> {
  // Verify webhook signature
  let event: Stripe.Event;

  try {
    event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.config.stripeWebhookSecret
    );
  } catch (error) {
    this.logger.error('Webhook signature verification failed', {
      error: error.message,
      signature: signature?.substring(0, 20) + '...',
    });
    throw new UnauthorizedException('Invalid signature');
  }

  // Process verified event
  await this.handleEvent(event);
}
```

**How Signature Verification Works:**

```
1. Stripe sends:
   - Body: JSON payload
   - Header: Stripe-Signature: t=1234567890,v1=abc123...

2. Signature format:
   - t: Timestamp (Unix epoch)
   - v1: HMAC-SHA256 of (timestamp + "." + body)

3. Verification:
   - Extract timestamp and signature from header
   - Compute expected signature using webhook secret
   - Compare signatures (constant-time comparison)
   - Check timestamp is within tolerance (5 minutes)

4. Security:
   - Prevents replay attacks (timestamp check)
   - Prevents tampering (signature verification)
   - Webhook secret never leaves server
```

#### Step 3: Event Parsing

**Type-safe event handling:**

```typescript
// Define event types
interface WebhookEventMap {
  'payment_intent.succeeded': Stripe.PaymentIntent;
  'payment_intent.payment_failed': Stripe.PaymentIntent;
  'invoice.paid': Stripe.Invoice;
  'invoice.payment_failed': Stripe.Invoice;
  'customer.subscription.created': Stripe.Subscription;
  'customer.subscription.updated': Stripe.Subscription;
  'customer.subscription.deleted': Stripe.Subscription;
}

type WebhookEventType = keyof WebhookEventMap;

async handleEvent(event: Stripe.Event): Promise<void> {
  this.logger.info('Processing webhook', {
    type: event.type,
    id: event.id,
  });

  // Type guard for known events
  const handler = this.eventHandlers[event.type as WebhookEventType];

  if (!handler) {
    this.logger.warn('No handler for event type', { type: event.type });
    return;
  }

  await handler(event.data.object);
}
```

#### Step 4: Idempotency

**Prevent duplicate processing:**

```typescript
async handleEvent(event: Stripe.Event): Promise<void> {
  // Check if already processed
  const processed = await this.redis.get(`webhook:${event.id}`);
  if (processed) {
    this.logger.info('Webhook already processed, skipping', { eventId: event.id });
    return;
  }

  // Process event
  await this.processEvent(event);

  // Mark as processed (TTL: 30 days)
  await this.redis.setex(`webhook:${event.id}`, 30 * 24 * 60 * 60, 'processed');

  // Store event log
  await this.prisma.webhookEvent.create({
    data: {
      stripeEventId: event.id,
      type: event.type,
      processedAt: new Date(),
      data: event.data.object as any,
    },
  });
}
```

**Why Idempotency Matters:**

```
Scenario: Network timeout during webhook processing

1. Stripe sends webhook
2. Server processes webhook
3. Database updates
4. Network timeout before 200 response
5. Stripe retries webhook
6. Without idempotency: Double processing!

Solution: Event ID tracking prevents reprocessing
```

#### Step 5: Event Routing

**Dispatch to appropriate handlers:**

```typescript
@Injectable()
export class WebhooksService {
  private eventHandlers: Record<string, (data: any) => Promise<void>>;

  constructor(
    private paymentsService: PaymentsService,
    private subscriptionsService: SubscriptionsService,
    private mailService: MailService,
  ) {
    // Map event types to handlers
    this.eventHandlers = {
      'payment_intent.succeeded': this.handlePaymentSuccess.bind(this),
      'payment_intent.payment_failed': this.handlePaymentFailure.bind(this),
      'invoice.paid': this.handleInvoicePaid.bind(this),
      'invoice.payment_failed': this.handleInvoicePaymentFailed.bind(this),
      'customer.subscription.created': this.handleSubscriptionCreated.bind(this),
      'customer.subscription.updated': this.handleSubscriptionUpdated.bind(this),
      'customer.subscription.deleted': this.handleSubscriptionDeleted.bind(this),
    };
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await this.paymentsService.confirmPayment(paymentIntent.id);
    await this.mailService.sendReceipt(paymentIntent);
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await this.paymentsService.markFailed(paymentIntent.id, paymentIntent.last_payment_error);
    await this.mailService.sendPaymentFailed(paymentIntent);
  }

  // ... other handlers
}
```

#### Step 6: Handler Execution

**Business logic implementation:**

```typescript
private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscription = await this.prisma.subscription.findUnique({
    where: { stripeSubscriptionId: invoice.subscription as string },
    include: { user: true },
  });

  if (!subscription) {
    this.logger.error('Subscription not found for invoice', { invoiceId: invoice.id });
    return;
  }

  // Update subscription period
  await this.prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      currentPeriodStart: new Date(invoice.period_start * 1000),
      currentPeriodEnd: new Date(invoice.period_end * 1000),
      status: 'active',
    },
  });

  // Generate internal invoice
  await this.invoicingService.generateInvoice(subscription, invoice);

  // Send receipt
  await this.mailService.sendInvoiceReceipt(subscription.user, invoice);

  // Update usage tracking (reset for new period)
  await this.usageService.resetPeriodUsage(subscription.id);
}
```

#### Step 7: Error Handling

**Graceful failure and retry:**

```typescript
async handleEvent(event: Stripe.Event): Promise<void> {
  try {
    await this.processEvent(event);
  } catch (error) {
    this.logger.error('Webhook handler failed', {
      eventId: event.id,
      type: event.type,
      error: error.message,
      stack: error.stack,
    });

    // Store failed event for retry
    await this.prisma.failedWebhook.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        data: event.data.object as any,
        error: error.message,
        retryCount: 0,
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    // Throw to trigger Stripe retry
    throw error;
  }
}

// Retry job (runs every 5 minutes)
@Cron(CronExpression.EVERY_5_MINUTES)
async retryFailedWebhooks(): Promise<void> {
  const failedWebhooks = await this.prisma.failedWebhook.findMany({
    where: {
      retryCount: { lt: 5 },
      nextRetryAt: { lte: new Date() },
    },
  });

  for (const webhook of failedWebhooks) {
    try {
      await this.processEvent({
        id: webhook.stripeEventId,
        type: webhook.type,
        data: { object: webhook.data },
      } as Stripe.Event);

      // Success - remove from failed
      await this.prisma.failedWebhook.delete({
        where: { id: webhook.id },
      });
    } catch (error) {
      // Update retry count
      await this.prisma.failedWebhook.update({
        where: { id: webhook.id },
        data: {
          retryCount: { increment: 1 },
          nextRetryAt: new Date(Date.now() + this.getBackoff(webhook.retryCount)),
          error: error.message,
        },
      });
    }
  }
}

private getBackoff(retryCount: number): number {
  // Exponential backoff: 5min, 10min, 20min, 40min, 80min
  return 5 * 60 * 1000 * Math.pow(2, retryCount);
}
```

#### Step 8: Database Updates

**Keeping system in sync:**

```typescript
// Transaction ensures consistency
await this.prisma.$transaction([
  // Update payment
  this.prisma.payment.update({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: {
      status: 'succeeded',
      paidAt: new Date(),
      receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
    },
  }),

  // Update order
  this.prisma.order.update({
    where: { id: order.id },
    data: { status: 'paid' },
  }),

  // Create transaction record
  this.prisma.transaction.create({
    data: {
      paymentId: payment.id,
      type: 'payment',
      amount: payment.amount,
      currency: payment.currency,
      status: 'completed',
    },
  }),

  // Mark webhook processed
  this.prisma.webhookEvent.update({
    where: { stripeEventId: event.id },
    data: { processedAt: new Date() },
  }),
]);
```

#### Step 9: Side Effects

**Non-critical operations:**

```typescript
private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  // Critical: Update database (must succeed)
  await this.updateDatabase(paymentIntent);

  // Side effects: Fire and forget (failures logged but don't block)
  this.sendReceiptEmail(paymentIntent).catch(err =>
    this.logger.error('Failed to send receipt', err)
  );

  this.updateAnalytics(paymentIntent).catch(err =>
    this.logger.error('Failed to update analytics', err)
  );

  this.notifyIntegrations(paymentIntent).catch(err =>
    this.logger.error('Failed to notify integrations', err)
  );
}
```

#### Step 10: Webhook Dashboard

**Monitoring and management:**

```typescript
@Controller('admin/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class WebhookAdminController {
  @Get('stats')
  async getWebhookStats(): Promise<WebhookStats> {
    const [total, failed, pending] = await Promise.all([
      this.prisma.webhookEvent.count(),
      this.prisma.failedWebhook.count(),
      this.prisma.webhookEvent.count({
        where: { processedAt: null },
      }),
    ]);

    return {
      total,
      failed,
      pending,
      successRate: total > 0 ? ((total - failed) / total) * 100 : 100,
    };
  }

  @Get('events')
  async getRecentEvents(
    @Query('limit') limit: number = 50,
    @Query('type') type?: string,
  ): Promise<WebhookEvent[]> {
    return this.prisma.webhookEvent.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  @Post('events/:id/retry')
  async retryEvent(@Param('id') eventId: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Re-process event
    await this.webhooksService.processEvent({
      id: event.stripeEventId,
      type: event.type,
      data: { object: event.data },
    } as Stripe.Event);
  }
}
```

**Key Insight:** Webhooks are the source of truth for payment state. Never rely on frontend confirmation alone—always wait for the webhook. Implement idempotency, signature verification, and retry logic to ensure reliability.

### 4.3 Authentication Flow

Authentication provides **secure, stateless session management** using JWT tokens stored in HTTP-only cookies, with Redis for session storage and revocation.

#### Complete Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    USER     │     │  FRONTEND   │     │   BACKEND   │     │    REDIS    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │  REGISTRATION     │                   │                   │
       │                   │                   │                   │
       │  1. Enter email/password              │                   │
       │──────────────────>│                   │                   │
       │                   │  2. POST /auth/register              │
       │                   │  { email, password, name }           │
       │                   │──────────────────>│                   │
       │                   │                   │  3. Validate input
       │                   │                   │  4. Check email unique
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
       │                   │                   │  5. Hash password
       │                   │                   │  bcrypt.hash(password, 12)
       │                   │                   │                   │
       │                   │                   │  6. Create user
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
       │                   │  7. Return user (no password)        │
       │                   │<──────────────────│                   │
       │  8. Show success  │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │  LOGIN            │                   │                   │
       │                   │                   │                   │
       │  9. Enter credentials                 │                   │
       │──────────────────>│                   │                   │
       │                   │  10. POST /auth/login                │
       │                   │  { email, password }                 │
       │                   │──────────────────>│                   │
       │                   │                   │  11. Find user by email
       │                   │                   │────┐              │
       │                   │                   │    │              │
       │                   │                   │<───┘              │
       │                   │                   │  12. Compare password
       │                   │                   │  bcrypt.compare()
       │                   │                   │                   │
       │                   │                   │  13. Generate JWT
       │                   │                   │  { userId, email, role }
       │                   │                   │                   │
       │                   │                   │  14. Store session
       │                   │                   │──────────────────>│
       │                   │                   │  session:{userId} = { token, createdAt }
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │                   │  15. Set HTTP-only cookie            │
       │                   │  Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict
       │                   │<──────────────────│                   │
       │  16. Redirect to app                  │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │  PROTECTED REQUEST                    │                   │
       │                   │                   │                   │
       │  17. Request /api/user              │                   │
       │  Cookie: token=xxx                    │                   │
       │──────────────────>│                   │                   │
       │                   │  18. Forward cookie                  │
       │                   │──────────────────>│                   │
       │                   │                   │  19. Validate JWT
       │                   │                   │  jwt.verify(token, secret)
       │                   │                   │                   │
       │                   │                   │  20. Check session in Redis
       │                   │                   │──────────────────>│
       │                   │                   │  Exists? Not revoked?
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │                   │                   │  21. Attach user to request
       │                   │                   │  @User() decorator
       │                   │                   │                   │
       │                   │  22. Return user data                │
       │                   │<──────────────────│                   │
       │  23. Display user │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │  LOGOUT           │                   │                   │
       │                   │                   │                   │
       │  24. Click logout │                   │                   │
       │──────────────────>│                   │                   │
       │                   │  25. POST /auth/logout               │
       │                   │  Cookie: token=xxx                    │
       │                   │──────────────────>│                   │
       │                   │                   │  26. Revoke session
       │                   │                   │──────────────────>│
       │                   │                   │  DEL session:{userId}
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │                   │  27. Clear cookie  │                   │
       │                   │  Set-Cookie: token=; Expires=Thu, 01 Jan 1970...
       │                   │<──────────────────│                   │
       │  28. Redirect to login              │                   │
       │<──────────────────│                   │                   │
```

#### Step 1: Registration

**User signup with validation:**

```typescript
@Controller('auth')
export class AuthController {
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<UserResponse> {
    // Validate input
    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    // Check email uniqueness
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Create user
    const user = await this.authService.register(dto);

    return this.mapToUserResponse(user);
  }
}

// DTO with validation
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;

  @IsString()
  @MinLength(2)
  name: string;
}
```

#### Step 2: Password Hashing

**Secure password storage with bcrypt:**

```typescript
@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12; // ~250ms to hash

  async register(dto: RegisterDto): Promise<User> {
    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    // Create user with hashed password
    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        password: hashedPassword,
        name: dto.name,
        role: Role.USER,
      },
    });
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) return null;

    // Compare password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    return user;
  }
}
```

**Why bcrypt:**
- Adaptive hashing (can increase rounds as computers get faster)
- Salt prevents rainbow table attacks
- Built-in timing attack protection
- Industry standard (used by Stripe, etc.)

#### Step 3: JWT Generation

**Token structure and signing:**

```typescript
interface JWTPayload {
  sub: string;        // User ID
  email: string;      // User email
  role: Role;         // User role
  iat: number;        // Issued at
  exp: number;        // Expiration
}

@Injectable()
export class JwtService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRATION = '15m'; // Short-lived access token

  generateToken(user: User): string {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
    };

    return jwt.sign(payload, this.JWT_SECRET);
  }

  verifyToken(token: string): JWTPayload {
    return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
  }
}
```

#### Step 4: Login

**Credential validation and token issuance:**

```typescript
@Post('login')
async login(
  @Body() dto: LoginDto,
  @Res({ passthrough: true }) res: Response
): Promise<LoginResponse> {
  // Validate credentials
  const user = await this.authService.validateCredentials(
    dto.email,
    dto.password
  );

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
    // Note: Same message for email not found vs wrong password
    // Prevents user enumeration attacks
  }

  // Check if user is suspended
  if (user.status === 'suspended') {
    throw new ForbiddenException('Account suspended');
  }

  // Generate tokens
  const accessToken = this.jwtService.generateToken(user);
  const refreshToken = this.generateRefreshToken();

  // Store session in Redis
  await this.redis.setex(
    `session:${user.id}`,
    7 * 24 * 60 * 60, // 7 days
    JSON.stringify({
      accessToken,
      refreshToken,
      createdAt: Date.now(),
    })
  );

  // Set HTTP-only cookie
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return {
    user: this.mapToUserResponse(user),
    expiresIn: 900, // 15 minutes
  };
}
```

#### Step 5: Token Refresh

**Extending sessions securely:**

```typescript
@Post('refresh')
async refreshToken(
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response
): Promise<LoginResponse> {
  const currentToken = req.cookies.token;
  if (!currentToken) {
    throw new UnauthorizedException('No token provided');
  }

  try {
    // Verify current token (may be expired)
    const payload = this.jwtService.verifyToken(currentToken);

    // Check session exists
    const session = await this.redis.get(`session:${payload.sub}`);
    if (!session) {
      throw new UnauthorizedException('Session expired');
    }

    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status === 'suspended') {
      throw new UnauthorizedException('Invalid session');
    }

    // Generate new token
    const newToken = this.jwtService.generateToken(user);

    // Update session
    await this.redis.setex(
      `session:${user.id}`,
      7 * 24 * 60 * 60,
      JSON.stringify({
        accessToken: newToken,
        refreshToken: JSON.parse(session).refreshToken,
        createdAt: Date.now(),
      })
    );

    // Set new cookie
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      user: this.mapToUserResponse(user),
      expiresIn: 900,
    };
  } catch (error) {
    throw new UnauthorizedException('Invalid token');
  }
}
```

#### Step 6: Protected Routes

**Guards validating JWT:**

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Verify JWT
      const payload = this.jwtService.verifyToken(token);

      // Check session in Redis (revocation check)
      const session = await this.redis.get(`session:${payload.sub}`);
      if (!session) {
        throw new UnauthorizedException('Session revoked');
      }

      // Attach user to request
      request.user = payload;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies?.token;
  }
}

// Usage on controller
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  @Post()
  async createPayment(
    @Body() dto: CreatePaymentDto,
    @User() user: JWTPayload // Custom decorator
  ) {
    return this.paymentsService.create(dto, user.sub);
  }
}
```

#### Step 7: Logout

**Token invalidation:**

```typescript
@Post('logout')
@UseGuards(JwtAuthGuard)
async logout(
  @User() user: JWTPayload,
  @Res({ passthrough: true }) res: Response
): Promise<void> {
  // Remove session from Redis
  await this.redis.del(`session:${user.sub}`);

  // Clear cookie
  res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0),
  });
}
```

#### Step 8: Password Reset

**Secure token-based reset flow:**

```typescript
@Post('forgot-password')
async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });

  // Don't reveal if email exists
  if (!user) {
    return; // Silently return
  }

  // Generate secure reset token (NOT JWT)
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store hashed token
  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: await bcrypt.hash(resetToken, 10),
      resetExpires,
    },
  });

  // Send email with plain token
  await this.mailService.sendPasswordReset(user.email, resetToken);
}

@Post('reset-password')
async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
  // Find user by email (token not stored in plain text)
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });

  if (!user || !user.resetToken || user.resetExpires < new Date()) {
    throw new BadRequestException('Invalid or expired token');
  }

  // Verify token
  const isValid = await bcrypt.compare(dto.token, user.resetToken);
  if (!isValid) {
    throw new BadRequestException('Invalid or expired token');
  }

  // Update password
  const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetExpires: null,
    },
  });

  // Revoke all sessions
  await this.redis.del(`session:${user.id}`);
}
```

**Reset Flow:**

```
1. User requests password reset
2. System generates crypto-random token
3. Token hashed and stored with expiration
4. Email sent with reset link: /reset-password?token=xxx&email=xxx
5. User clicks link, enters new password
6. Token verified against hash
7. Password updated, token cleared
8. All sessions revoked
```

#### Step 9: Session Management

**Redis for distributed session storage:**

```typescript
@Injectable()
export class SessionService {
  constructor(private redis: RedisService) {}

  async createSession(userId: string, token: string): Promise<void> {
    await this.redis.setex(
      `session:${userId}`,
      7 * 24 * 60 * 60, // 7 days
      JSON.stringify({
        token,
        createdAt: Date.now(),
        ip: '...', // Store for security
      })
    );
  }

  async revokeSession(userId: string): Promise<void> {
    await this.redis.del(`session:${userId}`);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    // Pattern match for multiple sessions per user
    const keys = await this.redis.keys(`session:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getSession(userId: string): Promise<Session | null> {
    const data = await this.redis.get(`session:${userId}`);
    return data ? JSON.parse(data) : null;
  }
}
```

#### Step 10: Role-Based Access

**Admin vs User roles:**

```typescript
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

// Role decorator
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// Role guard
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}

// Usage
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  @Get('users')
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Post('users/:id/suspend')
  @Roles(Role.ADMIN)
  async suspendUser(@Param('id') userId: string) {
    return this.usersService.suspend(userId);
  }
}
```

**Key Insight:** Authentication uses short-lived JWTs (15 minutes) with Redis-backed sessions for revocation. HTTP-only cookies prevent XSS token theft. Role-based access control separates user and admin capabilities. Password reset uses secure random tokens (not JWTs) with expiration.

### 4.4 Database Transaction Flow
[To be written - Prisma transactions, consistency]

---

## 5. Decision Framework

### 5.1 Technology Decisions

Technology decisions follow a **structured evaluation framework** that weighs current needs, future scalability, team expertise, and ecosystem maturity.

#### Decision Framework

```
┌─────────────────────────────────────────────────────────────┐
│  TECHNOLOGY DECISION FRAMEWORK                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. REQUIREMENTS                                            │
│     ├── Functional needs (what it must do)                  │
│     ├── Non-functional needs (performance, security)        │
│     └── Constraints (budget, timeline, team size)           │
│                                                             │
│  2. EVALUATION CRITERIA                                     │
│     ├── Maturity (production-ready, stable API)             │
│     ├── Ecosystem (libraries, community, docs)              │
│     ├── Team Fit (existing skills, learning curve)          │
│     ├── Integration (works with other choices)              │
│     └── Longevity (maintenance, vendor lock-in)             │
│                                                             │
│  3. OPTIONS ANALYSIS                                          │
│     ├── Option A: Pros/cons, trade-offs                     │
│     ├── Option B: Pros/cons, trade-offs                     │
│     └── Option C: Pros/cons, trade-offs                     │
│                                                             │
│  4. DECISION                                                  │
│     ├── Primary choice with rationale                       │
│     ├── Alternatives considered                             │
│     └── Reversibility (can we change later?)               │
│                                                             │
│  5. DOCUMENTATION                                             │
│     ├── Decision record (this document)                     │
│     ├── Migration path (if replacing)                       │
│     └── Success metrics (how we'll know it works)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Decision 1: Stripe vs Other Processors

**Options Considered:**

| Processor | Maturity | Features | Pricing | Decision |
|-----------|----------|----------|---------|----------|
| **Stripe** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ **Chosen** |
| Braintree | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Rejected |
| Adyen | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ❌ Rejected |
| Square | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ Rejected |

**Rationale for Stripe:**

1. **Developer Experience**: Best-in-class documentation, SDKs, and developer tools
2. **Feature Completeness**: Payments, subscriptions, Connect, invoicing, tax—all in one platform
3. **PCI Compliance**: Stripe Elements handle PCI scope reduction automatically
4. **Global Support**: 135+ currencies, local payment methods, international tax
5. **Ecosystem**: Extensive third-party integrations, active community
6. **Pricing**: Transparent 2.9% + $0.30, no monthly fees, volume discounts available

**Why Not Others:**
- **Braintree**: PayPal integration good, but documentation and developer experience inferior
- **Adyen**: Enterprise-focused, complex pricing, overkill for our scale
- **Square**: Good for in-person, weaker online/subscription features

**Reversibility**: Medium. Payment processor migration is complex but possible with dual-write strategy.

#### Decision 2: NestJS vs Express

**Options Considered:**

| Framework | Architecture | TypeScript | Learning Curve | Decision |
|-----------|------------|------------|----------------|----------|
| **NestJS** | Modular DI | Native | Medium | ✅ **Chosen** |
| Express | Minimal | Added | Low | ❌ Rejected |
| Fastify | Minimal | Native | Low | ❌ Rejected |
| Koa | Minimal | Native | Low | ❌ Rejected |

**Rationale for NestJS:**

1. **Enterprise Architecture**: Dependency injection, modular structure, decorators
2. **TypeScript Native**: First-class TypeScript support, no workarounds needed
3. **Built-in Patterns**: Guards, interceptors, pipes, filters—common patterns included
4. **Testing**: Built-in testing utilities, easy mocking with DI
5. **Documentation**: OpenAPI/Swagger integration, automatic API docs
6. **Team Scaling**: Enforces consistent patterns as team grows

**Express Comparison:**

```typescript
// Express: Manual route handling, no structure
app.post('/payments', async (req, res) => {
  // Validation? Manual.
  // Error handling? Manual.
  // Authentication? Manual.
  const payment = await createPayment(req.body);
  res.json(payment);
});

// NestJS: Declarative, structured, reusable
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  @Post()
  @UsePipes(ValidationPipe)
  async create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }
}
```

**Reversibility**: Low. NestJS is foundational; changing would require rewrite.

#### Decision 3: Next.js vs CRA (Create React App)

**Options Considered:**

| Framework | SSR | API Routes | Deployment | Decision |
|-----------|-----|------------|------------|----------|
| **Next.js** | ✅ | ✅ | Vercel/self | ✅ **Chosen** |
| CRA | ❌ | ❌ | Static | ❌ Rejected |
| Remix | ✅ | ✅ | Multiple | ❌ Rejected |
| Vite + React | ❌ | ❌ | Static | ❌ Rejected |

**Rationale for Next.js:**

1. **API Routes**: Built-in API proxying to backend, no CORS issues
2. **SSR/SSG**: Server-side rendering for performance, SEO if needed
3. **App Router**: Nested layouts, server components, reduced client JS
4. **Deployment**: Optimized for Vercel, works anywhere (Docker, AWS, etc.)
5. **Ecosystem**: Largest React framework ecosystem, extensive examples
6. **Stripe Integration**: Official `@stripe/stripe-js` and examples

**Why Not CRA:**
- No server-side capabilities
- No API routes (would need separate proxy)
- Client-side only (SEO limitations)
- Ejected from Facebook maintenance

**Reversibility**: Medium. Next.js is React-based; components are portable.

#### Decision 4: Prisma vs TypeORM

**Options Considered:**

| ORM | Type Safety | Migrations | Query API | Decision |
|-----|-------------|------------|-----------|----------|
| **Prisma** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ **Chosen** |
| TypeORM | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ❌ Rejected |
| Sequelize | ⭐⭐ | ⭐⭐ | ⭐⭐ | ❌ Rejected |
| Raw SQL | ⭐⭐⭐⭐ | ❌ | ⭐⭐ | ❌ Rejected |

**Rationale for Prisma:**

1. **Type Safety**: Auto-generated TypeScript types from schema
2. **Migrations**: Built-in migration system, version controlled
3. **Query Builder**: Intuitive, chainable API with autocomplete
4. **Performance**: Connection pooling, query optimization
5. **Studio**: Visual database management tool
6. **NestJS Integration**: Official `@nestjs/prisma` package

**Code Comparison:**

```typescript
// Prisma: Type-safe, auto-completed
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' },
  include: { payments: true },
});
// TypeScript knows user.payments is Payment[]

// TypeORM: Decorator-based, more verbose
const user = await userRepository.findOne({
  where: { email: 'user@example.com' },
  relations: ['payments'],
});
// Types require manual definition
```

**Reversibility**: Low. ORM is deeply integrated; migration would be significant.

#### Decision 5: PostgreSQL vs MongoDB

**Options Considered:**

| Database | ACID | Relations | Scaling | Decision |
|----------|------|-----------|---------|----------|
| **PostgreSQL** | ✅ | ✅ | Vertical | ✅ **Chosen** |
| MongoDB | Eventually | Manual | Horizontal | ❌ Rejected |
| MySQL | ✅ | ✅ | Vertical | ❌ Rejected |
| DynamoDB | Eventually | No | Serverless | ❌ Rejected |

**Rationale for PostgreSQL:**

1. **ACID Compliance**: Financial data requires strong consistency
2. **Relations**: Payments, users, subscriptions—relational data model fits
3. **JSON Support**: Flexible schema when needed (`jsonb` columns)
4. **Maturity**: 25+ years of production use, proven reliability
5. **Ecosystem**: Excellent tooling, monitoring, managed services
6. **Stripe Compatibility**: Stripe uses PostgreSQL; patterns align

**Why Not MongoDB:**
- Financial data requires transactions (MongoDB 4.0+ has them, but complex)
- Relational queries are common (payments + user + subscription)
- Schema validation important for payment data

**Reversibility**: Low. Database migrations are complex; choose carefully.

#### Decision 6: Redis vs Memcached

**Options Considered:**

| Cache | Data Types | Persistence | Pub/Sub | Decision |
|-------|------------|-------------|---------|----------|
| **Redis** | Rich | Optional | ✅ | ✅ **Chosen** |
| Memcached | Simple | ❌ | ❌ | ❌ Rejected |
| Memory | N/A | ❌ | ❌ | ❌ Rejected |

**Rationale for Redis:**

1. **Data Structures**: Strings, hashes, lists, sets—more than just key-value
2. **Persistence**: Can survive restarts (RDB snapshots, AOF)
3. **Pub/Sub**: Future real-time features (notifications, etc.)
4. **Sessions**: Hash data structure perfect for session storage
5. **Rate Limiting**: Built-in sliding window support
6. **Ecosystem**: Bull queues, Redis OM, extensive tooling

**Use Cases in App:**
- Session storage (hashes)
- Rate limiting (sorted sets with expiration)
- Exchange rate caching (strings with TTL)
- Webhook idempotency (strings with TTL)

**Reversibility**: High. Redis is a cache; can be replaced or removed.

#### Decision 7: RTK Query vs React Query

**Options Considered:**

| Library | Redux Integration | Caching | Mutations | Decision |
|---------|-------------------|---------|-----------|----------|
| **RTK Query** | Native | ✅ | ✅ | ✅ **Chosen** |
| React Query | Manual | ✅ | ✅ | ❌ Rejected |
| SWR | Manual | ✅ | ✅ | ❌ Rejected |
| Apollo | GraphQL | ✅ | ✅ | ❌ Rejected |

**Rationale for RTK Query:**

1. **Redux Integration**: Already using Redux Toolkit for state management
2. **Automatic Caching**: Cache invalidation via tags (`providesTags`, `invalidatesTags`)
3. **TypeScript**: Full type safety from API definition to component
4. **Code Generation**: API slice reduces boilerplate
5. **DevTools**: Redux DevTools show API state
6. **Mutations**: Optimistic updates, rollback on error

**Example:**

```typescript
// RTK Query: Declarative data fetching
const { data: payments, isLoading } = useGetPaymentsQuery();
const [createPayment] = useCreatePaymentMutation();

// Automatic cache invalidation when mutation succeeds
// No manual cache management needed
```

**Reversibility**: Medium. Data fetching is pervasive; migration would touch many components.

#### Decision 8: Vitest vs Jest

**Options Considered:**

| Framework | TypeScript | Speed | ESM | Decision |
|-----------|------------|-------|-----|----------|
| **Vitest** | Native | ⭐⭐⭐⭐⭐ | ✅ | ✅ **Chosen** |
| Jest | Config | ⭐⭐⭐ | Partial | ❌ Rejected |
| Node Test | Native | ⭐⭐⭐⭐ | ✅ | ❌ Rejected |
| Mocha | Config | ⭐⭐⭐ | ✅ | ❌ Rejected |

**Rationale for Vitest:**

1. **TypeScript Native**: No configuration needed, works out of box
2. **Speed**: Watch mode is instant, parallel execution
3. **ESM Support**: Native ES modules (Jest struggles here)
4. **Jest Compatible**: Similar API, easy migration path
5. **Coverage**: Built-in coverage with v8 (fast)
6. **NestJS Integration**: Works with `@nestjs/testing`

**Why Not Jest:**
- Configuration complexity for TypeScript + ESM
- Slower execution
- ESM support requires experimental flags

**Reversibility**: High. Tests are isolated; can migrate gradually.

#### Decision 9: Docker vs Native

**Options Considered:**

| Approach | Consistency | Complexity | Team Onboarding | Decision |
|----------|-------------|------------|-----------------|----------|
| **Docker** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **Chosen** |
| Native | ⭐⭐ | ⭐⭐ | ⭐⭐ | ❌ Rejected |
| Vagrant | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Rejected |

**Rationale for Docker:**

1. **Consistency**: Same environment for dev, staging, production
2. **Onboarding**: New developers productive in minutes (`docker-compose up`)
3. **Dependencies**: PostgreSQL, Redis versions pinned and isolated
4. **CI/CD**: Same containers in testing and deployment
5. **Scalability**: Easy horizontal scaling with container orchestration

**Docker Compose Setup:**

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: payments
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://app:${DB_PASSWORD}@postgres:5432/payments
      REDIS_URL: redis://redis:6379

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

**Reversibility**: High. Docker is development/deployment concern; app code unchanged.

#### Decision 10: Monorepo vs Separate Repos

**Options Considered:**

| Structure | Code Sharing | CI/CD | Team Coordination | Decision |
|-----------|--------------|-------|-------------------|----------|
| **Separate** | Manual | Separate | Loose | ✅ **Chosen** |
| Monorepo | Easy | Unified | Tight | ❌ Rejected |
| Monorepo (Turborepo) | Easy | Unified | Tight | ❌ Rejected |

**Rationale for Separate Repos:**

1. **Independent Deployment**: Frontend and backend deploy on different schedules
2. **Team Autonomy**: Frontend and backend teams work independently
3. **Simpler CI/CD**: No complex build pipelines
4. **Clear Boundaries**: API contract enforced via types, not implicit sharing
5. **Technology Flexibility**: Could migrate frontend to different framework without affecting backend

**Structure:**

```
stripe-payment-system/
├── backend/          # NestJS (separate repo in practice)
│   ├── src/
│   ├── prisma/
│   └── package.json
├── frontend/         # Next.js (separate repo in practice)
│   ├── app/
│   ├── components/
│   └── package.json
├── docker-compose.yml
└── README.md
```

**Why Not Monorepo:**
- Overkill for two services
- Couples deployment schedules
- Adds complexity (Turborepo/Nx configuration)

**Reversibility**: High. Can merge into monorepo later if needed.

#### Summary Table

| Decision | Choice | Reversibility | Key Factor |
|----------|--------|---------------|------------|
| Payment Processor | Stripe | Medium | Developer experience |
| Backend Framework | NestJS | Low | Enterprise patterns |
| Frontend Framework | Next.js | Medium | Full-stack capabilities |
| ORM | Prisma | Low | Type safety |
| Database | PostgreSQL | Low | ACID compliance |
| Cache | Redis | High | Data structures |
| Data Fetching | RTK Query | Medium | Redux integration |
| Testing | Vitest | High | TypeScript native |
| Deployment | Docker | High | Consistency |
| Repo Structure | Separate | High | Team autonomy |

**Key Insight:** Technology decisions balance immediate needs with long-term maintainability. Prefer mature, well-documented solutions with strong ecosystems. Reversibility matters—avoid decisions that lock you in without escape hatches.

### 5.2 Stripe API Selection

Stripe offers multiple APIs for similar use cases. Selecting the right API ensures optimal user experience, security, and maintainability.

#### Decision Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USE CASE                    │  RECOMMENDED API    │  ALTERNATIVES       │
├─────────────────────────────────────────────────────────────────────────┤
│  One-time payment            │  PaymentIntents     │  Checkout Sessions  │
│  Save card for later         │  SetupIntents       │  PaymentIntents     │
│  Recurring billing           │  Subscriptions API  │  Manual invoices    │
│  Self-service billing        │  Customer Portal    │  Custom UI          │
│  Marketplace payments        │  Connect            │  Manual transfers   │
│  Tax calculation             │  Tax API            │  Manual calculation │
│  Invoice generation          │  Internal (chosen)  │  Stripe Invoicing   │
│  Usage-based billing         │  Metered billing    │  Manual tracking    │
└─────────────────────────────────────────────────────────────────────────┘
```

#### PaymentIntents vs Checkout Sessions

**PaymentIntents (Chosen for this platform):**

```typescript
// Use when: Embedded checkout, full control over UI
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
});

// Frontend: Stripe.js PaymentElement
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: { return_url: '/success' },
});
```

**Checkout Sessions:**

```typescript
// Use when: Quick implementation, Stripe-hosted page
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: 'price_xxx', quantity: 1 }],
  mode: 'payment',
  success_url: '/success',
  cancel_url: '/cancel',
});

// Redirect to Stripe-hosted checkout
res.redirect(303, session.url);
```

**Comparison:**

| Factor | PaymentIntents | Checkout Sessions |
|--------|---------------|-------------------|
| **UI Control** | Full (embedded) | Limited (Stripe-hosted) |
| **Implementation** | More code | Less code |
| **Customization** | Complete | Branding only |
| **PCI Scope** | SAQ A (Elements) | SAQ A (Stripe handles all) |
| **Conversion** | Higher (in-context) | Lower (redirect) |
| **Mobile** | Native SDKs | Mobile-optimized page |

**Decision:** PaymentIntents for embedded checkout experience. Checkout Sessions for quick MVP or when redirect acceptable.

#### SetupIntents

**Use for: Saving payment methods without immediate charge**

```typescript
// Create SetupIntent
const setupIntent = await stripe.setupIntents.create({
  customer: customerId,
  automatic_payment_methods: { enabled: true },
});

// Frontend: Save card
const { error } = await stripe.confirmSetup({
  elements,
  confirmParams: { return_url: '/payment-methods' },
});

// Later: Use saved payment method
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'usd',
  customer: customerId,
  payment_method: savedPaymentMethodId, // From SetupIntent
  off_session: true, // Customer not present
});
```

**Use Cases:**
- Free trial (no charge until trial ends)
- Pay later (authorize now, charge later)
- Subscription creation (payment method required, but charge on cycle)

#### Subscription API

**Use for: Recurring billing with automatic invoicing**

```typescript
// Create subscription
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: 'price_xxx' }], // Recurring price
  default_payment_method: paymentMethodId,
  trial_period_days: 14,
});

// Stripe automatically:
// - Creates invoices
// - Attempts payment
// - Handles failures and retries
// - Manages billing cycles
```

**Subscription Features:**

| Feature | API Method |
|---------|------------|
| Create subscription | `stripe.subscriptions.create()` |
| Update plan | `stripe.subscriptions.update()` |
| Cancel | `stripe.subscriptions.cancel()` |
| Pause | `stripe.subscriptions.update({ pause_collection: {...} })` |
| Proration | Automatic with `proration_behavior` |
| Trials | `trial_period_days` parameter |

#### Customer Portal

**Use for: Self-service subscription management**

```typescript
// Create portal session
const session = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: 'https://app.example.com/account',
});

// Redirect to Stripe-hosted portal
res.redirect(303, session.url);
```

**Portal Capabilities:**

| Feature | Customer Action |
|---------|-----------------|
| Update payment methods | Add, remove, set default |
| View invoice history | Download PDFs |
| Cancel subscription | Immediate or end-of-period |
| Update subscription | Upgrade/downgrade plans |
| Update billing info | Address, email, tax ID |

**Configuration:**

```typescript
// Configure portal features
await stripe.billingPortal.configurations.create({
  features: {
    payment_method_update: { enabled: true },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price', 'quantity'],
    },
    subscription_cancel: { enabled: true },
    invoice_history: { enabled: true },
  },
  business_profile: {
    privacy_policy_url: 'https://example.com/privacy',
    terms_of_service_url: 'https://example.com/terms',
  },
});
```

**Decision:** Use Customer Portal for standard self-service. Build custom UI only for complex workflows not supported by portal.

#### Connect API

**Use for: Marketplace, platform payments, multi-party transactions**

```typescript
// Create connected account (seller)
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});

// Create direct charge (customer → seller, platform fee)
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000,
  currency: 'usd',
  application_fee_amount: 500, // Platform fee: $5.00
  transfer_data: {
    destination: account.id,
  },
});
```

**Connect Use Cases:**

| Scenario | Implementation |
|----------|----------------|
| Marketplace | Direct charges with application fees |
| Platform | Separate charges and transfers |
| On-demand | Express accounts with onboarding |
| SaaS billing | Standard accounts for large vendors |

#### Invoices API

**Decision: Internal invoicing over Stripe Invoicing**

**Why Internal:**

```typescript
// Internal invoice generation
async generateInvoice(paymentId: string) {
  const payment = await this.prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true },
  });

  // Generate PDF with Puppeteer
  const pdfBuffer = await this.generatePdf({
    template: 'invoice',
    data: {
      invoiceNumber: payment.invoiceNumber,
      amount: payment.amount,
      currency: payment.currency,
      user: payment.user,
      items: payment.items,
    },
  });

  // Store and send
  await this.storage.upload(`invoices/${payment.invoiceNumber}.pdf`, pdfBuffer);
  await this.mailService.sendInvoice(payment.user.email, pdfBuffer);
}
```

**Comparison:**

| Factor | Stripe Invoicing | Internal Invoicing |
|--------|------------------|---------------------|
| **Customization** | Limited | Full control |
| **Multi-currency display** | Basic | Advanced |
| **Custom line items** | Limited | Any structure |
| **Branding** | Stripe branding | Full branding |
| **Implementation** | API calls | More code |
| **Maintenance** | Stripe handles | Self-maintained |

**When to Use Stripe Invoicing:**
- Quick implementation needed
- Standard B2B invoicing
- No custom requirements

**When to Use Internal:**
- Custom invoice design required
- Complex line items (usage, proration, discounts)
- Multi-currency display requirements
- Integration with existing accounting system

#### Tax API

**Use for: Automatic tax calculation**

```typescript
// Calculate tax
const calculation = await stripe.tax.calculations.create({
  currency: 'usd',
  line_items: [{
    amount: 1000,
    reference: 'Product A',
  }],
  customer_details: {
    address: {
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94105',
      country: 'US',
    },
  },
});

// Apply to PaymentIntent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 1000 + calculation.tax_amount_exclusive,
  currency: 'usd',
  metadata: {
    tax_calculation: calculation.id,
  },
});
```

**Tax API Features:**

| Feature | Support |
|---------|---------|
| US sales tax | All states |
| EU VAT | All countries |
| UK VAT | ✅ |
| Canada GST/PST | ✅ |
| Australia GST | ✅ |
| Tax ID validation | VAT, GST, ABN |

**Decision:** Use Stripe Tax for automatic calculation. Manual calculation only for simple cases or unsupported jurisdictions.

#### Sigma/Reporting

**Use for: Advanced analytics and reporting**

```sql
-- Sigma query: Monthly revenue by currency
SELECT
  currency,
  DATE_TRUNC('month', created) AS month,
  SUM(amount) / 100.0 AS revenue
FROM charges
WHERE status = 'succeeded'
GROUP BY currency, month
ORDER BY month DESC;
```

**Reporting Options:**

| Tool | Use Case |
|------|----------|
| **Stripe Dashboard** | Quick insights, standard reports |
| **Sigma** | SQL queries on Stripe data |
| **Reporting API** | Programmatic access to reports |
| **Internal analytics** | Custom dashboards, combined data sources |

**Decision:** Use Stripe Dashboard for standard metrics. Build internal analytics for custom KPIs and combined data (usage + payments + user behavior).

#### Test Mode vs Live Mode

**Testing Strategy:**

```
Test Mode (All development)
├── Test API keys (sk_test_xxx, pk_test_xxx)
├── Test webhook endpoints
├── No real charges
├── Special test card numbers
└── Isolated from live data

Live Mode (Production only)
├── Live API keys (sk_live_xxx, pk_live_xxx)
├── Real charges
├── Real money movement
└── No test data
```

**Test Cards:**

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Success |
| 4000 0027 6000 3184 | Requires 3D Secure |
| 4000 0084 0000 1280 | Insufficient funds |
| 4000 0000 0000 9995 | Declined |
| 4000 0000 0000 3220 | Requires SCA (EU) |

**Environment Configuration:**

```typescript
// config.ts
export const config = {
  stripe: {
    secretKey: process.env.NODE_ENV === 'production'
      ? process.env.STRIPE_LIVE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY,
    webhookSecret: process.env.NODE_ENV === 'production'
      ? process.env.STRIPE_LIVE_WEBHOOK_SECRET
      : process.env.STRIPE_TEST_WEBHOOK_SECRET,
  },
};
```

#### API Versioning

**Handling Stripe API Updates:**

```typescript
// Pin API version in code
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // Pin to specific version
});

// Webhook events include API version
// Handle version-specific parsing if needed
async handleWebhook(event: Stripe.Event) {
  if (event.api_version !== '2024-06-20') {
    this.logger.warn('Event from different API version', {
      eventId: event.id,
      version: event.api_version,
    });
  }

  // Process event...
}
```

**Version Management:**

| Strategy | Implementation |
|----------|----------------|
| **Pin version** | Specify in Stripe client initialization |
| **Monitor changelog** | Subscribe to Stripe API updates |
| **Test new versions** | Use Stripe CLI to test before upgrading |
| **Gradual migration** | Update version in staging first |

**Breaking Changes Handling:**

```typescript
// Version-specific handling
async getPaymentIntent(id: string) {
  const paymentIntent = await stripe.paymentIntents.retrieve(id);

  // Handle field changes between versions
  const amount = paymentIntent.amount;
  const currency = paymentIntent.currency;

  // New field in newer version
  const automaticPaymentMethods = (paymentIntent as any).automatic_payment_methods;

  return { amount, currency, automaticPaymentMethods };
}
```

#### Summary

| API | Use When | Avoid When |
|-----|----------|------------|
| **PaymentIntents** | Embedded checkout, full control | Quick MVP, redirect OK |
| **Checkout Sessions** | Quick implementation, hosted page | Need full UI control |
| **SetupIntents** | Save cards without charging | Immediate charge needed |
| **Subscriptions** | Recurring billing | One-time payments only |
| **Customer Portal** | Standard self-service | Custom workflows needed |
| **Connect** | Marketplace, platform payments | Simple merchant account |
| **Tax API** | Automatic tax calculation | Simple tax rules |
| **Internal Invoicing** | Custom requirements | Standard invoicing OK |

**Key Insight:** Start with Stripe's highest-level API that meets your needs (Customer Portal, Checkout). Drop down to lower-level APIs (PaymentIntents) only when you need customization. This minimizes code and maximizes Stripe's built-in optimizations.

### 5.3 Error Handling Strategy
[To be written - Result pattern vs exceptions]

---

## 6. Security & Compliance Flow

### 6.1 Security-First Development

Security is not a feature—it's a **foundational requirement** built into every layer of the application. Payment systems are high-value targets; defense in depth is mandatory.

#### Defense in Depth Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: PERIMETER SECURITY                                             │
│  ├── HTTPS/TLS 1.3 (all traffic encrypted)                              │
│  ├── WAF (Web Application Firewall)                                     │
│  ├── DDoS protection (Cloudflare/AWS Shield)                            │
│  └── IP allowlisting (admin endpoints)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 2: APPLICATION SECURITY                                           │
│  ├── Input validation (Zod schemas)                                     │
│  ├── Rate limiting (per-route, per-user)                              │
│  ├── Authentication (JWT + Redis sessions)                              │
│  ├── Authorization (RBAC with guards)                                   │
│  └── CORS policies (strict origin validation)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 3: DATA SECURITY                                                  │
│  ├── Encryption at rest (PostgreSQL TDE)                                │
│  ├── Encryption in transit (TLS 1.3)                                    │
│  ├── No sensitive data in logs                                        │
│  └── Tokenization (Stripe handles card data)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 4: INFRASTRUCTURE SECURITY                                        │
│  ├── Secrets management (environment variables, Vault)                  │
│  ├── Container security (non-root users, read-only fs)                │
│  ├── Network segmentation (private subnets)                           │
│  └── Dependency scanning (Snyk, Dependabot)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### PCI Compliance with Stripe Elements

**PCI Scope Reduction:**

```
Without Stripe Elements:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USER      │────>│   SERVER    │────>│   DATABASE  │
│  Enters card│     │ Receives    │     │ Stores card │
│  number     │     │ card number │     │ number      │
└─────────────┘     └─────────────┘     └─────────────┘
     │
     └── PCI Scope: ENTIRE SYSTEM (SAQ D - 300+ questions)

With Stripe Elements:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   USER      │────>│   STRIPE    │────>│   SERVER    │
│  Enters card│     │  Elements   │     │ Receives    │
│  in iframe  │     │  (iframe)   │     │  token only │
└─────────────┘     └─────────────┘     └─────────────┘
     │
     └── PCI Scope: STRIPE ONLY (SAQ A - 22 questions)
```

**Implementation:**

```typescript
// Frontend: Card data never touches our code
import { PaymentElement } from '@stripe/react-stripe-js';

export function PaymentForm() {
  return (
    <form>
      <PaymentElement />  {/* Stripe-hosted iframe */}
      <button>Pay</button>
    </form>
  );
}

// Backend: Only receives payment method ID (token)
async createPayment(dto: CreatePaymentDto) {
  // dto.paymentMethodId = 'pm_xxx' (token, not card number)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: dto.amount,
    currency: dto.currency,
    payment_method: dto.paymentMethodId, // Token only
  });
}
```

**PCI Compliance Levels:**

| Level | Description | Requirements |
|-------|-------------|--------------|
| **SAQ A** | Card-not-present, fully outsourced | Stripe Elements, 22 questions |
| **SAQ A-EP** | Card-not-present, partially outsourced | Redirect-based, 139 questions |
| **SAQ D** | Card-present or card data stored | 300+ questions, annual audit |

**Decision:** Stripe Elements = SAQ A (simplest compliance).

#### Input Validation

**Zod Schema Validation:**

```typescript
import { z } from 'zod';

// Payment creation schema
const CreatePaymentSchema = z.object({
  amount: z.number()
    .int()
    .min(50, 'Minimum amount is $0.50')
    .max(1000000, 'Maximum amount is $10,000'),
  currency: z.enum(['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy']),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string()).optional(),
});

// NestJS pipe
@Controller('payments')
export class PaymentsController {
  @Post()
  @UsePipes(new ZodValidationPipe(CreatePaymentSchema))
  async create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }
}

// Validation pipe implementation
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw error;
    }
  }
}
```

**Sanitization Rules:**

| Input Type | Sanitization | Example |
|------------|--------------|---------|
| Email | Normalize, validate format | `user@example.com` |
| Strings | Trim, escape HTML | `'<script>'` → `'&lt;script&gt;'` |
| Numbers | Clamp to valid range | `-5` → error, `1000001` → error |
| IDs | Validate UUID format | `550e8400-e29b-41d4-a716-446655440000` |
| Metadata | Key-value string only | `{ orderId: '123' }` |

#### Authentication Security

**JWT Best Practices:**

```typescript
// Token configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,        // 256-bit random key
  expiresIn: '15m',                      // Short-lived access token
  issuer: 'stripe-payment-system',       // Token issuer
  audience: 'stripe-payment-system',     // Token audience
};

// Token generation
function generateToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_CONFIG.secret,
    {
      expiresIn: JWT_CONFIG.expiresIn,
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    }
  );
}

// Token verification
function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_CONFIG.secret, {
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience,
  }) as JWTPayload;
}
```

**Security Measures:**

| Measure | Implementation |
|---------|----------------|
| **HTTP-only cookies** | `res.cookie('token', token, { httpOnly: true })` |
| **Secure flag** | `secure: process.env.NODE_ENV === 'production'` |
| **SameSite strict** | `sameSite: 'strict'` (CSRF protection) |
| **Short expiration** | 15 minutes access token |
| **Refresh tokens** | Separate long-lived token for renewal |
| **Token revocation** | Redis session storage for instant invalidation |

#### Authorization (RBAC)

**Role-Based Access Control:**

```typescript
// Role definitions
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

// Permission matrix
const PERMISSIONS = {
  'payments:create': [Role.USER, Role.ADMIN],
  'payments:read': [Role.USER, Role.ADMIN],
  'payments:refund': [Role.ADMIN],
  'users:read': [Role.ADMIN],
  'users:suspend': [Role.ADMIN],
  'webhooks:retry': [Role.ADMIN],
};

// Guard implementation
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions) return true;

    const { user } = context.switchToHttp().getRequest();

    return requiredPermissions.every(permission =>
      PERMISSIONS[permission]?.includes(user.role)
    );
  }
}

// Usage
@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  @Post('users/:id/suspend')
  @SetMetadata('permissions', ['users:suspend'])
  async suspendUser(@Param('id') userId: string) {
    return this.usersService.suspend(userId);
  }
}
```

#### Rate Limiting

**Multi-Layer Rate Limiting:**

```typescript
// Global rate limiting
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,        // 1 minute window
          limit: 100,        // 100 requests per minute
        },
      ],
    }),
  ],
})
export class AppModule {}

// Route-specific rate limiting
@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle(5, 300)  // 5 attempts per 5 minutes
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @Throttle(3, 3600) // 3 registrations per hour
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}

@Controller('payments')
export class PaymentsController {
  @Post()
  @Throttle(10, 60)  // 10 payments per minute
  async createPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }
}
```

**Rate Limit Response:**

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "retryAfter": 45
}
```

#### Data Encryption

**Encryption at Rest:**

```typescript
// PostgreSQL with TDE (Transparent Data Encryption)
// Configured at database level, automatic for all tables

// Application-level encryption for sensitive fields
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
      iv
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
      Buffer.from(ivHex, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

**Encryption in Transit:**

```typescript
// TLS 1.3 configuration
const httpsOptions = {
  key: fs.readFileSync('private.key'),
  cert: fs.readFileSync('certificate.crt'),
  minVersion: 'TLSv1.3',
  cipherSuites: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
};

// HSTS header
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

#### Secret Management

**Environment Variables:**

```bash
# .env.example (template, never commit secrets)
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payments

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# JWT
JWT_SECRET=your-256-bit-secret-key-here

# Encryption
ENCRYPTION_KEY=your-256-bit-encryption-key

# Application
NODE_ENV=development
PORT=3001
```

**Secret Validation at Startup:**

```typescript
// config.validation.ts
export function validateConfig(config: Record<string, any>): void {
  const requiredSecrets = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
  ];

  for (const secret of requiredSecrets) {
    if (!config[secret]) {
      throw new Error(`Missing required secret: ${secret}`);
    }

    // Check for default/placeholder values
    if (config[secret].includes('xxx') || config[secret].includes('your-')) {
      throw new Error(`Invalid secret value for ${secret}: appears to be placeholder`);
    }
  }

  // Validate key lengths
  if (config.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}
```

#### Audit Logging

**Security Event Tracking:**

```typescript
@Injectable()
export class AuditService {
  constructor(private logger: Logger) {}

  log(event: AuditEvent): void {
    const auditLog = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      result: event.result,
      metadata: event.metadata,
    };

    // Log to secure audit log (separate from application logs)
    this.logger.log('AUDIT', auditLog);

    // Store in database for querying
    this.prisma.auditLog.create({ data: auditLog });
  }
}

// Usage in guards
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      // Validate token...
      const user = await this.validateToken(request);
      request.user = user;

      // Log successful authentication
      this.auditService.log({
        type: 'AUTHENTICATION',
        userId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: request.url,
        action: 'LOGIN',
        result: 'SUCCESS',
      });

      return true;
    } catch (error) {
      // Log failed authentication
      this.auditService.log({
        type: 'AUTHENTICATION',
        userId: null,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        resource: request.url,
        action: 'LOGIN',
        result: 'FAILURE',
        metadata: { error: error.message },
      });

      throw error;
    }
  }
}
```

**Audit Events:**

| Event Type | Description |
|------------|-------------|
| `AUTHENTICATION` | Login, logout, token refresh |
| `AUTHORIZATION` | Permission denied, role change |
| `PAYMENT` | Payment created, succeeded, failed |
| `USER` | User created, updated, suspended |
| `WEBHOOK` | Webhook received, processed, failed |
| `ADMIN` | Admin actions (refunds, transfers) |

#### Dependency Scanning

**Vulnerability Management:**

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run npm audit
        run: npm audit --audit-level=high

      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
```

**Dependency Update Policy:**

| Severity | Action | Timeline |
|----------|--------|----------|
| Critical | Immediate update | Within 24 hours |
| High | Update in next sprint | Within 1 week |
| Medium | Update in next maintenance | Within 1 month |
| Low | Update when convenient | Next quarter |

**Key Insight:** Security is a continuous process, not a one-time checklist. Every feature must consider security implications. When in doubt, choose the more secure option—even if it's more work. Payment systems are trust systems; security breaches destroy trust permanently.

### 6.2 PCI Compliance Boundaries

PCI DSS (Payment Card Industry Data Security Standard) compliance is **mandatory** for any system handling cardholder data. Stripe Elements reduce our scope to the simplest level: SAQ A.

#### PCI DSS Scope Reduction

```
┌─────────────────────────────────────────────────────────────────────────┐
│  WITHOUT STRIPE ELEMENTS (SAQ D - 300+ requirements)                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Our System:                                                              │
│  ├── Receive card numbers (encrypted, but we have keys)                 │
│  ├── Store card numbers (encrypted at rest)                             │
│  ├── Process card numbers (in memory)                                   │
│  ├── Transmit card numbers (to Stripe)                                  │
│  └── PCI Scope: ENTIRE INFRASTRUCTURE                                   │
│       ├── All servers                                                   │
│       ├── All databases                                                 │
│       ├── All networks                                                  │
│       ├── All personnel                                                 │
│       └── Annual QSA audit ($50,000+)                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  WITH STRIPE ELEMENTS (SAQ A - 22 requirements)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Our System:                                                              │
│  ├── Receive payment method tokens (pm_xxx)                             │
│  ├── Store tokens (not card data)                                       │
│  ├── Process tokens (not card data)                                     │
│  └── PCI Scope: MINIMAL                                                  │
│       ├── Web server (only)                                             │
│       ├── No card data storage                                          │
│       ├── No encryption keys for card data                              │
│       └── Self-assessment questionnaire (no audit)                      │
│                                                                           │
│  Stripe Handles:                                                          │
│  ├── Card data collection (iframe)                                      │
│  ├── Card data encryption                                               │
│  ├── Card data storage (vault)                                          │
│  ├── All PCI requirements for card data                                 │
│  └── Annual Level 1 PCI audit (highest level)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### SAQ A Requirements

**22 Requirements (Simplified):**

| Requirement | Description | Implementation |
|-------------|-------------|------------------|
| **1. Firewall** | Install and maintain firewall | AWS Security Groups, VPC |
| **2. Passwords** | No default passwords | Enforced on all systems |
| **3. Cardholder data** | Protect stored data | We don't store card data |
| **4. Encryption** | Encrypt transmission | TLS 1.3 everywhere |
| **5. Antivirus** | Use antivirus | Not applicable (containers) |
| **6. Development** | Secure development | Code review, dependency scanning |
| **7. Access** | Need-to-know access | RBAC, least privilege |
| **8. Authentication** | Unique IDs | JWT + Redis sessions |
| **9. Physical** | Physical access controls | AWS data center security |
| **10. Logging** | Track access to data | Audit logging |
| **11. Testing** | Regular security testing | Penetration tests, vulnerability scans |
| **12. Policy** | Security policy | Documented procedures |

**Key Point:** Requirements 3 (cardholder data protection) is satisfied by not storing card data.

#### Card Data Never Touches Our Servers

**Data Flow Verification:**

```typescript
// ❌ NEVER DO THIS
@Post('payment')
async createPayment(@Body() dto: any) {
  // DANGER: Card number in our system!
  const { cardNumber, expiry, cvc } = dto;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1000,
    currency: 'usd',
    payment_method_data: {
      card: {
        number: cardNumber,      // ❌ PCI scope explosion!
        exp_month: expiry.month,
        exp_year: expiry.year,
        cvc: cvc,
      },
    },
  });
}

// ✅ CORRECT APPROACH
@Post('payment')
async createPayment(@Body() dto: CreatePaymentDto) {
  // Safe: Only payment method ID (token)
  const { paymentMethodId } = dto; // 'pm_xxx'

  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1000,
    currency: 'usd',
    payment_method: paymentMethodId, // ✅ Token only
  });
}
```

**What We Store:**

```typescript
// Database schema - NO card data
model Payment {
  id                    String   @id @default(uuid())
  stripePaymentIntentId String   @unique
  stripePaymentMethodId String?  // 'pm_xxx' - token, not card number
  amount                Int
  currency              String
  status                String
  userId                String
  createdAt             DateTime @default(now())

  // ❌ NO cardNumber field
  // ❌ NO expiryDate field
  // ❌ NO cvc field
}
```

**What Stripe Stores:**

```
Stripe Vault (PCI Level 1 Compliant):
├── Card number: 4242 4242 4242 4242 (encrypted)
├── Expiry month: 12
├── Expiry year: 2025
├── CVC: *** (not stored after verification)
└── Fingerprint: fp_xxx (for duplicate detection)

We receive: pm_xxx (payment method ID)
```

#### Stripe Elements Implementation

**How Elements Work:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Our Domain: app.example.com                                     │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  React Component                                        │   │   │
│  │  │  ┌─────────────────────────────────────────────────┐   │   │   │
│  │  │  │  Stripe iframe: js.stripe.com                   │   │   │   │
│  │  │  │  ┌─────────────────────────────────────────┐   │   │   │   │
│  │  │  │  │  Secure input field                     │   │   │   │   │
│  │  │  │  │  • Card number entry                    │   │   │   │   │
│  │  │  │  │  • Encrypted to Stripe                │   │   │   │   │
│  │  │  │  │  • Our code never sees data           │   │   │   │   │
│  │  │  │  └─────────────────────────────────────────┘   │   │   │   │
│  │  │  └─────────────────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

Card data path:
User keyboard → Browser → Stripe iframe → Stripe servers (encrypted)
                              ↑
                              └── Our JavaScript cannot access iframe content
                                  (same-origin policy)
```

**Implementation Check:**

```typescript
// Verify no card data in logs
@Interceptor()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Check for card data patterns in request
    const body = JSON.stringify(request.body);
    const cardPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;

    if (cardPattern.test(body)) {
      this.logger.error('Potential card data detected in request', {
        path: request.url,
        ip: request.ip,
      });
      throw new BadRequestException('Invalid request');
    }

    return next.handle();
  }
}
```

#### Network Segmentation

**Isolating Payment Systems:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AWS VPC                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Public Subnet (ALB)                                            │   │
│  │  └── Load Balancer (TLS termination)                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Private Subnet (Application)                                   │   │
│  │  ├── Frontend containers (Next.js)                              │   │
│  │  └── Backend containers (NestJS)                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Database Subnet (Isolated)                                     │   │
│  │  ├── PostgreSQL (no public access)                              │   │
│  │  └── Redis (no public access)                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

Security Groups:
- ALB: 443 from internet
- App: 3000 from ALB only
- Database: 5432/6379 from App only
```

#### Access Controls

**Who Can Access What:**

| Role | Production DB | Stripe Dashboard | User Data | Payment Data |
|------|---------------|-------------------|-----------|--------------|
| **Developer** | Read-only (masked) | Test mode only | Read | Read (tokens) |
| **DevOps** | Full (break-glass) | Test mode only | No access | No access |
| **Admin** | Read-only (masked) | Live mode (limited) | Full | Full (tokens) |
| **Support** | No access | No access | Read (masked) | Read (masked) |

**Access Control Implementation:**

```typescript
// Database access logging
@Injectable()
export class DatabaseAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Log all database access
    this.auditService.log({
      type: 'DATABASE_ACCESS',
      userId: user.id,
      action: 'QUERY',
      resource: request.url,
      timestamp: new Date(),
    });

    // Check role permissions
    if (request.url.includes('/admin') && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
```

#### Vulnerability Scanning

**ASV (Approved Scanning Vendor) Scans:**

```yaml
# Quarterly external vulnerability scans
name: PCI ASV Scan

on:
  schedule:
    - cron: '0 0 1 */3 *'  # Quarterly

jobs:
  asv-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Run external vulnerability scan
        uses: qualified-security/scan-action@v1
        with:
          target: https://api.example.com
          scan-type: pci-asv

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: asv-scan-results
          path: scan-results.pdf
```

**Penetration Testing:**

| Test Type | Frequency | Scope |
|-----------|-----------|-------|
| **External penetration** | Annual | Public APIs, web app |
| **Internal penetration** | Annual | Internal network, APIs |
| **Application security** | Quarterly | Code review, SAST |
| **Dependency scan** | Continuous | Snyk, Dependabot |

#### Security Policies

**Required Documentation:**

```markdown
# Information Security Policy

## 1. Purpose
Define security requirements for payment processing system.

## 2. Scope
Applies to all personnel with access to production systems.

## 3. Access Control
- Principle of least privilege
- Role-based access control (RBAC)
- Quarterly access reviews
- Immediate revocation on termination

## 4. Data Protection
- No cardholder data storage (Stripe handles)
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Secure key management

## 5. Incident Response
- 24-hour breach notification
- Incident response team
- Forensic preservation
- Customer notification procedures

## 6. Vendor Management
- Due diligence for third parties
- PCI compliance validation
- Contractual security requirements
- Annual reassessment
```

#### Incident Response

**Breach Response Plan:**

```
HOUR 0: Detection
├── Automated alert triggers
├── Security team notified
├── Incident declared
└── Response team assembled

HOUR 1: Containment
├── Affected systems isolated
├── Evidence preserved
├── Forensic images captured
└── Law enforcement notified (if required)

HOUR 4: Assessment
├── Scope of breach determined
├── Data types involved identified
├── Root cause analysis
└── Remediation plan drafted

HOUR 24: Notification
├── Affected customers notified
├── Regulatory authorities notified
├── Card brands notified (if card data involved)
└── Public disclosure (if required)

HOUR 72: Recovery
├── Systems restored
├── Security patches applied
├── Monitoring enhanced
└── Post-incident review
```

**Incident Response Contacts:**

| Role | Contact | Responsibility |
|------|---------|------------------|
| Incident Commander | security@example.com | Overall coordination |
| Technical Lead | devops@example.com | Technical response |
| Legal | legal@example.com | Regulatory compliance |
| Communications | pr@example.com | External communications |
| Stripe | security@stripe.com | Payment processor coordination |

#### Third-Party Services

**Vendor Compliance Validation:**

| Vendor | Service | PCI Compliance | Validation |
|--------|---------|----------------|------------|
| **Stripe** | Payment processing | Level 1 PCI DSS | Annual audit report |
| **AWS** | Infrastructure | Level 1 PCI DSS | Shared responsibility |
| **Cloudflare** | CDN/WAF | Level 1 PCI DSS | Annual audit report |
| **SendGrid** | Email delivery | SOC 2 Type II | Annual audit report |

**Vendor Assessment Checklist:**

```typescript
interface VendorAssessment {
  name: string;
  service: string;
  pciCompliant: boolean;
  soc2Type2: boolean;
  dataProcessingAgreement: boolean;
  breachNotification: string; // SLA
  penetrationTest: string;  // Frequency
  accessControls: string[];
}

const vendorAssessments: VendorAssessment[] = [
  {
    name: 'Stripe',
    service: 'Payment Processing',
    pciCompliant: true,
    soc2Type2: true,
    dataProcessingAgreement: true,
    breachNotification: '24 hours',
    penetrationTest: 'Continuous',
    accessControls: ['SSO', 'MFA', 'RBAC'],
  },
  // ... other vendors
];
```

#### Annual Assessment

**SAQ A Completion:**

```
Annual PCI Compliance Checklist:

□ Complete SAQ A (Self-Assessment Questionnaire)
  └── 22 requirements reviewed and documented

□ External vulnerability scan (ASV)
  └── Quarterly scans, passing results

□ Penetration test
  └── Annual external test by qualified vendor

□ Security policy review
  └── Updated and acknowledged by all personnel

□ Access control review
  └── All accounts reviewed, terminated access removed

□ Vendor compliance validation
  └── All third parties confirmed compliant

□ Incident response drill
  └── Tabletop exercise completed

□ Security awareness training
  └── All personnel completed training

□ Documentation update
  └── Network diagrams, data flow diagrams current
```

**Compliance Calendar:**

| Month | Activity |
|-------|----------|
| January | Annual SAQ completion |
| March | Q1 vulnerability scan |
| June | Penetration test |
| June | Q2 vulnerability scan |
| September | Q3 vulnerability scan |
| October | Security policy review |
| December | Q4 vulnerability scan |
| December | Annual compliance review |

**Key Insight:** PCI compliance is not a checkbox—it's a continuous process. Stripe Elements reduce our burden significantly, but we must still maintain security around tokens, authentication, and access controls. Annual assessments validate our ongoing compliance.

### 6.3 Rate Limiting Strategy
[To be written - Per-route limits, global protection]

---

## 7. Testing & Quality Flow

### 7.1 Testing Pyramid

Testing follows the **pyramid model**: many fast, isolated unit tests; fewer integration tests; minimal slow E2E tests. This provides confidence while maintaining speed.

#### Testing Pyramid Structure

```
                    ┌─────────┐
                    │   E2E   │  ← 5% of tests
                    │  Tests  │    Slow, expensive
                    │  (5%)   │    Full user flows
                    ├─────────┤
                   ┌───────────┐
                   │ Integration│  ← 15% of tests
                   │   Tests   │    Component interactions
                   │   (15%)   │    Database, APIs
                   ├───────────┤
                  ┌─────────────┐
                  │    Unit      │  ← 80% of tests
                  │    Tests     │    Fast, isolated
                  │    (80%)     │    Business logic
                  └─────────────┘

Speed: Fast ────────────────────────────→ Slow
Cost:  Low  ────────────────────────────→ High
Confidence: Low ────────────────────────→ High
```

#### Unit Tests (80%)

**Characteristics:**
- **Fast**: < 100ms per test
- **Isolated**: No database, no network, no file system
- **Deterministic**: Same input → same output
- **Focused**: One concept per test

**Example: PaymentsService Unit Test**

```typescript
// payments.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: jest.Mocked<PrismaService>;
  let stripe: jest.Mocked<StripeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: createPrismaMock(),
        },
        {
          provide: StripeService,
          useValue: createStripeMock(),
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get(PrismaService);
    stripe = module.get(StripeService);
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent with correct amount', async () => {
      // Arrange
      const dto = { amount: 2000, currency: 'usd' };
      const user = createUserFactory();
      const mockPaymentIntent = createPaymentIntentFactory({
        amount: 2000,
        currency: 'usd',
      });

      stripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Act
      const result = await service.createPaymentIntent(dto, user);

      // Assert
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2000,
        currency: 'usd',
        customer: user.stripeCustomerId,
        automatic_payment_methods: { enabled: true },
        metadata: expect.any(Object),
      });
      expect(result.clientSecret).toBe(mockPaymentIntent.client_secret);
    });

    it('should throw error for amount below minimum', async () => {
      // Arrange
      const dto = { amount: 10, currency: 'usd' }; // $0.10
      const user = createUserFactory();

      // Act & Assert
      await expect(service.createPaymentIntent(dto, user))
        .rejects
        .toThrow('Amount below minimum');
    });

    it('should create customer if not exists', async () => {
      // Arrange
      const dto = { amount: 2000, currency: 'usd' };
      const user = createUserFactory({ stripeCustomerId: null });
      const mockCustomer = createCustomerFactory();
      const mockPaymentIntent = createPaymentIntentFactory();

      stripe.customers.create.mockResolvedValue(mockCustomer);
      stripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Act
      await service.createPaymentIntent(dto, user);

      // Assert
      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: user.email,
        metadata: { userId: user.id },
      });
    });
  });

  describe('refundPayment', () => {
    it('should create full refund', async () => {
      // Arrange
      const payment = createPaymentFactory({ amount: 2000 });
      const mockRefund = createRefundFactory({ amount: 2000 });

      prisma.payment.findUnique.mockResolvedValue(payment);
      stripe.refunds.create.mockResolvedValue(mockRefund);

      // Act
      const result = await service.refundPayment(payment.id, { amount: 2000 });

      // Assert
      expect(stripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: payment.stripePaymentIntentId,
        amount: 2000,
      });
      expect(result.amount).toBe(2000);
    });

    it('should throw if payment already refunded', async () => {
      // Arrange
      const payment = createPaymentFactory({
        status: 'refunded',
        refundedAmount: 2000,
      });

      prisma.payment.findUnique.mockResolvedValue(payment);

      // Act & Assert
      await expect(service.refundPayment(payment.id, { amount: 100 }))
        .rejects
        .toThrow('Payment already fully refunded');
    });
  });
});
```

**Unit Test Principles:**

| Principle | Description |
|-----------|-------------|
| **AAA** | Arrange, Act, Assert structure |
| **One assertion** | One concept per test |
| **Descriptive names** | `should X when Y` |
| **No shared state** | Each test independent |
| **Fast execution** | Mock all dependencies |

#### Integration Tests (15%)

**Characteristics:**
- **Medium speed**: 100ms - 1s per test
- **Database**: Test with real database (test container)
- **API boundaries**: Test service interactions
- **Realistic data**: Use factories with realistic values

**Example: API Integration Test**

```typescript
// payments.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PaymentsController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.payment.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /payments', () => {
    it('should create payment and store in database', async () => {
      // Arrange
      const user = await prisma.user.create({
        data: createUserFactory(),
      });
      const token = generateTestToken(user);

      // Act
      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 2000, currency: 'usd' })
        .expect(201);

      // Assert
      expect(response.body.clientSecret).toBeDefined();

      // Verify database state
      const payment = await prisma.payment.findFirst({
        where: { userId: user.id },
      });
      expect(payment).toBeDefined();
      expect(payment.amount).toBe(2000);
      expect(payment.currency).toBe('usd');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/payments')
        .send({ amount: 2000, currency: 'usd' })
        .expect(401);
    });

    it('should validate amount is positive', async () => {
      const user = await prisma.user.create({
        data: createUserFactory(),
      });
      const token = generateTestToken(user);

      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: -100, currency: 'usd' })
        .expect(400);
    });
  });
});
```

**Integration Test Setup:**

```typescript
// test/setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';

export async function setupTestEnvironment() {
  // Start PostgreSQL container
  const postgres = await new PostgreSqlContainer()
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();

  // Start Redis container
  const redis = await new RedisContainer().start();

  // Set environment variables
  process.env.DATABASE_URL = postgres.getConnectionUri();
  process.env.REDIS_URL = redis.getConnectionUrl();

  // Run migrations
  await execAsync('npx prisma migrate deploy');

  return { postgres, redis };
}
```

#### E2E Tests (5%)

**Characteristics:**
- **Slow**: 1s+ per test
- **Full stack**: Frontend + Backend + Database
- **User perspective**: Test like a real user
- **Critical paths only**: Login, payment, subscription

**Example: Payment Flow E2E Test**

```typescript
// e2e/payment.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Payment Flow', () => {
  test('user can complete payment', async ({ page }) => {
    // Arrange
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to payment
    await page.goto('/payment');
    await page.fill('[name="amount"]', '50.00');

    // Act - Fill Stripe Elements (in iframe)
    const frame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    await frame.locator('[placeholder="Card number"]').fill('4242424242424242');
    await frame.locator('[placeholder="MM / YY"]').fill('12/25');
    await frame.locator('[placeholder="CVC"]').fill('123');

    await page.click('button:has-text("Pay")');

    // Assert
    await expect(page.locator('text=Payment successful')).toBeVisible();
    await expect(page).toHaveURL('/payment/success');
  });

  test('user sees error for declined card', async ({ page }) => {
    // Arrange
    await loginAsUser(page, 'test@example.com');
    await page.goto('/payment');
    await page.fill('[name="amount"]', '50.00');

    // Act - Use declined card
    const frame = page.frameLocator('iframe').first();
    await frame.locator('[placeholder="Card number"]').fill('4000000000009995');
    await frame.locator('[placeholder="MM / YY"]').fill('12/25');
    await frame.locator('[placeholder="CVC"]').fill('123');

    await page.click('button:has-text("Pay")');

    // Assert
    await expect(page.locator('text=Your card was declined')).toBeVisible();
  });
});
```

**E2E Test Configuration:**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start:test',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### Test Coverage

**Target Coverage:**

| Layer | Target | Minimum |
|-------|--------|---------|
| **Unit tests** | 80% | 70% |
| **Integration tests** | 60% | 50% |
| **E2E tests** | Critical paths | Login, payment, subscription |

**Coverage Configuration:**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.spec.ts',
        '**/*.test.ts',
        'dist/',
        'prisma/',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
```

**Coverage Report:**

```
 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |   82.34 |    75.21 |   85.43 |   82.34 |
 payments |   88.12 |    82.45 |   91.23 |   88.12 | 45-48,89-92
 auth     |   79.34 |    71.23 |   83.45 |   79.34 | 23-28,56-60
 webhooks |   75.89 |    68.90 |   78.34 |   75.89 | 112-120
----------|---------|----------|---------|---------|-------------------
```

#### Mocking

**Mocking External Services:**

```typescript
// test/mocks/stripe.mock.ts
export function createStripeMock() {
  return {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };
}

// Mock implementation
stripe.paymentIntents.create.mockImplementation((params) => {
  return Promise.resolve({
    id: `pi_${faker.string.alphanumeric(24)}`,
    client_secret: `pi_${faker.string.alphanumeric(24)}_secret_${faker.string.alphanumeric(24)}`,
    amount: params.amount,
    currency: params.currency,
    status: 'requires_confirmation',
    ...params,
  });
});
```

**Mocking Database:**

```typescript
// test/mocks/prisma.mock.ts
export function createPrismaMock() {
  return {
    payment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callbacks) => Promise.all(callbacks)),
  };
}
```

#### Factories

**Creating Test Data:**

```typescript
// test/factories/user.factory.ts
import { faker } from '@faker-js/faker';

export function createUserFactory(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    password: faker.internet.password(),
    role: 'user',
    stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
    preferredCurrency: 'USD',
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

// test/factories/payment.factory.ts
export function createPaymentFactory(overrides?: Partial<Payment>): Payment {
  return {
    id: faker.string.uuid(),
    stripePaymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
    stripePaymentMethodId: `pm_${faker.string.alphanumeric(24)}`,
    amount: faker.number.int({ min: 100, max: 10000 }),
    currency: 'USD',
    status: 'succeeded',
    userId: faker.string.uuid(),
    createdAt: faker.date.past(),
    paidAt: faker.date.recent(),
    ...overrides,
  };
}
```

#### CI/CD Integration

**GitHub Actions Workflow:**

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

#### Flaky Test Prevention

**Making Tests Reliable:**

```typescript
// ❌ Flaky: Depends on current time
test('should format date', () => {
  const result = formatDate(new Date());
  expect(result).toBe('2024-01-15'); // Fails tomorrow!
});

// ✅ Stable: Fixed date
test('should format date', () => {
  const fixedDate = new Date('2024-01-15T10:00:00Z');
  const result = formatDate(fixedDate);
  expect(result).toBe('2024-01-15');
});

// ❌ Flaky: Random data
test('should validate email', () => {
  const email = faker.internet.email(); // Random each run
  expect(isValidEmail(email)).toBe(true);
});

// ✅ Stable: Explicit test cases
test.each([
  ['user@example.com', true],
  ['invalid-email', false],
  ['@example.com', false],
])('should validate email %s', (email, expected) => {
  expect(isValidEmail(email)).toBe(expected);
});

// ❌ Flaky: Async without await
test('should save payment', async () => {
  service.savePayment({ amount: 100 }); // Missing await!
  const payment = await db.findPayment();
  expect(payment).toBeDefined(); // May or may not exist
});

// ✅ Stable: Proper async handling
test('should save payment', async () => {
  await service.savePayment({ amount: 100 });
  const payment = await db.findPayment();
  expect(payment).toBeDefined();
});
```

**Flaky Test Checklist:**

- [ ] No random data without seeding
- [ ] No current time without mocking
- [ ] No network calls without mocking
- [ ] No file system without cleanup
- [ ] No shared state between tests
- [ ] Proper async/await usage
- [ ] Database transactions rolled back

#### Test Organization

**File Structure:**

```
src/
├── payments/
│   ├── payments.service.ts
│   ├── payments.controller.ts
│   ├── payments.module.ts
│   ├── dto/
│   └── __tests__/
│       ├── payments.service.spec.ts      # Unit tests
│       └── payments.controller.spec.ts # Unit tests
├── auth/
│   ├── auth.service.ts
│   └── __tests__/
│       └── auth.service.spec.ts
test/
├── integration/
│   ├── payments.integration.spec.ts     # Integration tests
│   └── auth.integration.spec.ts
├── e2e/
│   ├── payment.spec.ts                  # E2E tests
│   └── auth.spec.ts
├── factories/
│   ├── user.factory.ts
│   ├── payment.factory.ts
│   └── index.ts
├── mocks/
│   ├── stripe.mock.ts
│   ├── prisma.mock.ts
│   └── index.ts
└── setup.ts                             # Test setup
```

**Naming Conventions:**

| Type | Pattern | Example |
|------|---------|---------|
| **Unit** | `*.spec.ts` | `payments.service.spec.ts` |
| **Integration** | `*.integration.spec.ts` | `payments.integration.spec.ts` |
| **E2E** | `*.spec.ts` in `e2e/` | `e2e/payment.spec.ts` |

#### Test-Driven Development

**Red-Green-Refactor Cycle:**

```typescript
// Step 1: RED - Write failing test
describe('calculateProration', () => {
  it('should calculate prorated amount for upgrade', () => {
    const result = calculateProration({
      oldPlan: { price: 1000 }, // $10/month
      newPlan: { price: 3000 }, // $30/month
      daysRemaining: 15,
      daysInMonth: 30,
    });

    expect(result).toBe({
      credit: 500,    // $5 remaining on old plan
      charge: 1500,   // $15 for new plan
      netDue: 1000,   // $10 due now
    });
  });
});
// Test fails: calculateProration is not defined

// Step 2: GREEN - Write minimal code to pass
export function calculateProration(params: ProrationParams) {
  const dailyOld = params.oldPlan.price / params.daysInMonth;
  const dailyNew = params.newPlan.price / params.daysInMonth;

  const credit = dailyOld * params.daysRemaining;
  const charge = dailyNew * params.daysRemaining;

  return {
    credit: Math.round(credit),
    charge: Math.round(charge),
    netDue: Math.round(charge - credit),
  };
}
// Test passes

// Step 3: REFACTOR - Improve code while keeping tests green
// (Add edge cases, improve naming, extract helpers)
```

**TDD Benefits:**

| Benefit | Description |
|---------|-------------|
| **Design** | Forces testable design |
| **Documentation** | Tests document behavior |
| **Confidence** | Know when you're done |
| **Regression** | Prevents breaking changes |

**Key Insight:** Testing is not optional for payment systems. The pyramid approach ensures fast feedback (unit tests) while maintaining confidence (integration + E2E). Target 80%+ coverage on critical paths (payments, auth, webhooks). Flaky tests erode trust—fix them immediately.

### 7.2 Test-Driven Development

Test-Driven Development (TDD) is **mandatory** for this codebase. Writing tests before implementation ensures testable design, clear requirements, and confidence in changes.

#### TDD Cycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RED → GREEN → REFACTOR                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. RED: Write a failing test                                           │
│     ├── Define expected behavior                                        │
│     ├── Write minimal test case                                         │
│     └── Watch it fail (confirm test is valid)                           │
│                                                                         │
│  2. GREEN: Write minimal code to pass                                   │
│     ├── Implement just enough to make test pass                         │
│     ├── Don't worry about elegance                                      │
│     └── All tests should pass                                           │
│                                                                         │
│  3. REFACTOR: Clean up the code                                         │
│     ├── Improve naming, structure, performance                          │
│     ├── Remove duplication                                              │
│     └── Ensure tests still pass                                         │
│                                                                         │
│  Repeat for each new behavior                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### TDD Example: Refund Calculation

**Step 1: RED - Write Failing Test**

```typescript
// payments.service.spec.ts
describe('calculateRefundAmount', () => {
  it('should calculate full refund when no previous refunds', () => {
    const payment = {
      amount: 10000,        // $100.00
      refundedAmount: 0,
      status: 'succeeded',
    };

    const result = service.calculateRefundAmount(payment, null);

    expect(result.availableAmount).toBe(10000);
    expect(result.canRefundFull).toBe(true);
  });

  it('should calculate partial refund availability', () => {
    const payment = {
      amount: 10000,        // $100.00
      refundedAmount: 3000, // $30.00 already refunded
      status: 'succeeded',
    };

    const result = service.calculateRefundAmount(payment, null);

    expect(result.availableAmount).toBe(7000); // $70.00 remaining
    expect(result.canRefundFull).toBe(false);
  });

  it('should throw error for already fully refunded payment', () => {
    const payment = {
      amount: 10000,
      refundedAmount: 10000,
      status: 'refunded',
    };

    expect(() => service.calculateRefundAmount(payment, null))
      .toThrow('Payment already fully refunded');
  });
});

// Run tests: FAIL (calculateRefundAmount doesn't exist yet)
```

**Step 2: GREEN - Minimal Implementation**

```typescript
// payments.service.ts
export class PaymentsService {
  calculateRefundAmount(
    payment: Payment,
    requestedAmount: number | null
  ): RefundCalculation {
    // Minimal implementation to pass tests
    const availableAmount = payment.amount - payment.refundedAmount;

    if (availableAmount <= 0) {
      throw new Error('Payment already fully refunded');
    }

    return {
      availableAmount,
      canRefundFull: availableAmount === payment.amount,
    };
  }
}

// Run tests: PASS
```

**Step 3: REFACTOR - Clean Up**

```typescript
// payments.service.ts
export class PaymentsService {
  calculateRefundAmount(
    payment: Payment,
    requestedAmount: number | null
  ): RefundCalculation {
    const availableAmount = this.calculateAvailableAmount(payment);

    if (availableAmount <= 0) {
      throw new RefundError('PAYMENT_ALREADY_REFUNDED');
    }

    return {
      availableAmount,
      canRefundFull: this.isFullRefundAvailable(payment, availableAmount),
      requestedAmount,
      isPartial: requestedAmount !== null && requestedAmount < availableAmount,
    };
  }

  private calculateAvailableAmount(payment: Payment): number {
    return payment.amount - payment.refundedAmount;
  }

  private isFullRefundAvailable(
    payment: Payment,
    availableAmount: number
  ): boolean {
    return availableAmount === payment.amount;
  }
}

// Run tests: PASS (refactoring preserved behavior)
```

#### TDD Benefits for Payment Systems

| Benefit | Description | Example |
|---------|-------------|---------|
| **Clarity** | Tests define requirements | "What should happen for partial refund?" |
| **Safety** | Changes don't break existing logic | Refund calculation can be optimized |
| **Design** | Forces testable, modular code | Services have single responsibility |
| **Documentation** | Tests show how code works | New devs read tests to understand |
| **Confidence** | Know when feature is done | All tests pass = feature complete |

#### TDD for Bug Fixes

**Bug Report:** "Partial refunds show wrong available amount"

```typescript
// Step 1: Write failing test that reproduces bug
describe('Bug: Partial refund calculation', () => {
  it('should correctly calculate available amount after partial refund', () => {
    // Bug: Was showing $100 available instead of $70
    const payment = createPayment({
      amount: 10000,        // $100.00
      refundedAmount: 3000, // $30.00
    });

    const result = service.getRefundInfo(payment.id);

    expect(result.availableForRefund).toBe(7000); // Should be $70.00
    expect(result.alreadyRefunded).toBe(3000);    // Should be $30.00
  });
});

// Step 2: Confirm test fails (reproduces bug)
// Expected: 7000, Received: 10000

// Step 3: Fix the bug
async getRefundInfo(paymentId: string) {
  const payment = await this.prisma.payment.findUnique({
    where: { id: paymentId },
  });

  // Bug was: using payment.amount instead of calculating remaining
  return {
    availableForRefund: payment.amount - payment.refundedAmount, // Fixed
    alreadyRefunded: payment.refundedAmount,
  };
}

// Step 4: Test passes, bug is fixed
```

#### TDD for Edge Cases

**Edge Case Discovery Through Testing:**

```typescript
describe('createPaymentIntent', () => {
  // Happy path
  it('should create payment intent for valid amount', () => {
    // ...
  });

  // Edge cases discovered through TDD
  it('should reject amount below minimum ($0.50)', () => {
    expect(() => service.createPaymentIntent({ amount: 49 }))
      .toThrow('Minimum amount is $0.50');
  });

  it('should reject amount above maximum ($10,000)', () => {
    expect(() => service.createPaymentIntent({ amount: 1000001 }))
      .toThrow('Maximum amount is $10,000');
  });

  it('should handle currency with different decimal places', () => {
    // JPY has no decimal places
    const result = service.createPaymentIntent({
      amount: 1000, // ¥1000 (no cents)
      currency: 'JPY',
    });
    expect(result.amount).toBe(1000);
  });

  it('should round fractional cents correctly', () => {
    // Conversion might result in fractional cents
    const result = service.createPaymentIntent({
      amount: 3333, // $33.33
      currency: 'USD',
    });
    // Should round to nearest cent, not truncate
    expect(result.amount).toBe(3333);
  });
});
```

#### When NOT to TDD

**Exceptions (Rare):**

| Scenario | Approach | Reason |
|----------|----------|--------|
| **Spike/Prototype** | No tests | Exploring feasibility |
| **Configuration** | No tests | No logic to test |
| **Generated code** | No tests | Code is generated |
| **UI styling** | Visual testing | CSS is hard to unit test |

**Payment System Rule:** Everything except pure configuration gets TDD'd.

#### TDD Checklist

Before committing code:

- [ ] Test written before implementation
- [ ] Test fails before implementation (RED)
- [ ] Minimal code to make test pass (GREEN)
- [ ] Refactored for clarity (REFACTOR)
- [ ] Edge cases covered
- [ ] Error paths tested
- [ ] All tests pass
- [ ] No test coverage regressions

#### TDD Workflow in Practice

```bash
# 1. Start with failing test
$ npm test -- payments.service.spec.ts
# FAIL: calculateRefundAmount is not defined

# 2. Write minimal implementation
# (edit payments.service.ts)

# 3. Run tests again
$ npm test -- payments.service.spec.ts
# PASS

# 4. Refactor
# (improve code structure)

# 5. Run full test suite
$ npm test
# ALL PASS

# 6. Commit
$ git add .
$ git commit -m "feat: add refund calculation

- Calculate available refund amount
- Handle partial and full refunds
- Validate payment status before refund

Closes #123"
```

**Key Insight:** TDD feels slower initially but saves time long-term. Payment systems require confidence—TDD provides it. The test is the spec; the implementation makes the spec pass. Never skip the RED step (confirming the test fails) or you might have a false positive.

### 7.3 Critical Path Testing

Critical paths are **business-critical workflows** that must never break. These get the highest testing priority and coverage requirements.

#### Critical Paths Definition

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CRITICAL PATHS (Must Always Work)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. PAYMENT PROCESSING                                                  │
│     ├── Create payment intent                                           │
│     ├── Confirm payment                                                 │
│     ├── Handle webhook confirmation                                     │
│     └── Process refund                                                  │
│                                                                         │
│  2. SUBSCRIPTION MANAGEMENT                                             │
│     ├── Create subscription                                             │
│     ├── Handle recurring billing                                        │
│     ├── Process subscription update                                     │
│     └── Handle cancellation                                             │
│                                                                         │
│  3. AUTHENTICATION                                                      │
│     ├── User registration                                               │
│     ├── Login with valid credentials                                  │
│     ├── Token refresh                                                   │
│     └── Access protected resources                                      │
│                                                                         │
│  4. WEBHOOK PROCESSING                                                  │
│     ├── Receive webhook                                                 │
│     ├── Verify signature                                                │
│     ├── Process event                                                   │
│     └── Handle idempotency                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Critical Path Coverage Requirements

| Path | Coverage Target | Test Types |
|------|-----------------|------------|
| **Payment Processing** | 95% | Unit, Integration, E2E |
| **Subscription Management** | 90% | Unit, Integration, E2E |
| **Authentication** | 95% | Unit, Integration, E2E |
| **Webhook Processing** | 90% | Unit, Integration |

#### Payment Processing Critical Path

**Test Suite:**

```typescript
// critical/payments.critical.spec.ts
describe('CRITICAL: Payment Processing', () => {
  describe('Happy Path', () => {
    it('should process complete payment flow', async () => {
      // 1. Create payment intent
      const { clientSecret, paymentIntentId } = await paymentsService
        .createPaymentIntent({ amount: 2000, currency: 'usd' }, user);

      expect(clientSecret).toBeDefined();
      expect(paymentIntentId).toBeDefined();

      // 2. Confirm payment (simulated Stripe confirmation)
      await simulateStripeConfirmation(paymentIntentId);

      // 3. Process webhook
      const webhookEvent = createWebhookEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      });
      await webhooksService.handleWebhook(webhookEvent);

      // 4. Verify database state
      const payment = await prisma.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      });
      expect(payment.status).toBe('succeeded');
      expect(payment.paidAt).toBeDefined();

      // 5. Verify receipt email sent
      expect(mailService.sendReceipt).toHaveBeenCalled();
    });
  });

  describe('Failure Recovery', () => {
    it('should handle failed payment gracefully', async () => {
      const { paymentIntentId } = await paymentsService
        .createPaymentIntent({ amount: 2000, currency: 'usd' }, user);

      // Simulate failed payment
      await simulateStripeFailure(paymentIntentId, 'card_declined');

      const webhookEvent = createWebhookEvent('payment_intent.payment_failed', {
        id: paymentIntentId,
        last_payment_error: { code: 'card_declined' },
      });
      await webhooksService.handleWebhook(webhookEvent);

      const payment = await prisma.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      });
      expect(payment.status).toBe('failed');
    });

    it('should handle webhook retry correctly', async () => {
      const { paymentIntentId } = await paymentsService
        .createPaymentIntent({ amount: 2000, currency: 'usd' }, user);

      const webhookEvent = createWebhookEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      });

      // First attempt
      await webhooksService.handleWebhook(webhookEvent);

      // Second attempt (idempotency)
      await webhooksService.handleWebhook(webhookEvent);

      // Should not create duplicate records
      const payments = await prisma.payment.findMany({
        where: { stripePaymentIntentId: paymentIntentId },
      });
      expect(payments).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent webhook processing', async () => {
      const { paymentIntentId } = await paymentsService
        .createPaymentIntent({ amount: 2000, currency: 'usd' }, user);

      const webhookEvent = createWebhookEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      });

      // Process concurrently
      await Promise.all([
        webhooksService.handleWebhook(webhookEvent),
        webhooksService.handleWebhook(webhookEvent),
        webhooksService.handleWebhook(webhookEvent),
      ]);

      // Should only have one payment record
      const payments = await prisma.payment.findMany({
        where: { stripePaymentIntentId: paymentIntentId },
      });
      expect(payments).toHaveLength(1);
    });

    it('should handle 3D Secure flow', async () => {
      const { clientSecret, paymentIntentId } = await paymentsService
        .createPaymentIntent({ amount: 2000, currency: 'usd' }, user);

      // Simulate 3D Secure required
      await simulateStripe3DSecure(paymentIntentId);

      // After authentication
      await simulateStripeConfirmation(paymentIntentId);

      const webhookEvent = createWebhookEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      });
      await webhooksService.handleWebhook(webhookEvent);

      const payment = await prisma.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      });
      expect(payment.status).toBe('succeeded');
    });
  });
});
```

#### Critical Path Monitoring

**Production Monitoring:**

```typescript
// monitoring/critical-paths.monitor.ts
@Injectable()
export class CriticalPathMonitor {
  constructor(
    private metrics: MetricsService,
    private alerts: AlertService,
  ) {}

  async monitorPaymentSuccessRate(): Promise<void> {
    const successRate = await this.metrics.getPaymentSuccessRate({
      timeRange: '1h',
    });

    if (successRate < 0.95) {
      await this.alerts.sendCriticalAlert({
        severity: 'critical',
        path: 'payment_processing',
        metric: 'success_rate',
        value: successRate,
        threshold: 0.95,
        message: `Payment success rate dropped to ${(successRate * 100).toFixed(2)}%`,
      });
    }
  }
}
```

**Key Insight:** Critical paths are the business. If payments fail, the business stops. These tests run on every commit, every PR, and before every deployment. When a critical path test fails, all deployments halt until fixed.

---

## 8. Deployment & Operations Flow

### 8.1 Docker Compose Architecture

Docker Compose provides **local development parity** with production, enabling new developers to be productive in minutes and ensuring consistency across environments.

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DOCKER COMPOSE NETWORK                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │   FRONTEND      │────>│    BACKEND      │────>│   POSTGRESQL    │   │
│  │   (Next.js)     │     │   (NestJS)      │     │    (Port 5432)  │   │
│  │   Port: 3000    │     │   Port: 3001    │     │                 │   │
│  │                 │     │                 │     │  Database:      │   │
│  │  • React 19     │     │  • API routes   │     │  payments       │   │
│  │  • Stripe.js    │     │  • Business     │     │                 │   │
│  │  • RTK Query    │     │    logic        │     │  Volumes:       │   │
│  │                 │     │  • Prisma ORM   │     │  postgres_data  │   │
│  └─────────────────┘     └────────┬────────┘     └─────────────────┘   │
│           │                       │                                     │
│           │                       │                                     │
│           │                       ▼                                     │
│           │              ┌─────────────────┐                            │
│           │              │     REDIS       │                            │
│           │              │   (Port 6379)   │                            │
│           │              │                 │                            │
│           │              │  • Sessions     │                            │
│           │              │  • Rate limit   │                            │
│           │              │  • Cache        │                            │
│           │              │                 │                            │
│           │              │  Volumes:       │                            │
│           │              │  redis_data     │                            │
│           │              └─────────────────┘                            │
│           │                                                             │
│           └────────────────────────────────────────────────────────────>│
│                              API Proxy (Next.js routes)                  │
│                              /api/* → backend:3001                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Docker Compose Configuration

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: stripe-payments-postgres
    environment:
      POSTGRES_DB: payments
      POSTGRES_USER: ${DB_USER:-app}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-devpassword}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-app} -d payments"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: stripe-payments-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: stripe-payments-backend
    environment:
      NODE_ENV: development
      PORT: 3001
      DATABASE_URL: postgresql://${DB_USER:-app}:${DB_PASSWORD:-devpassword}@postgres:5432/payments
      REDIS_URL: redis://redis:6379
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      JWT_SECRET: ${JWT_SECRET:-dev-jwt-secret-change-in-production}
    volumes:
      - ./backend:/app
      - /app/node_modules
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: >
      sh -c "npx prisma migrate dev --name init && npm run start:dev"
    networks:
      - app-network

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: stripe-payments-frontend
    environment:
      NODE_ENV: development
      NEXT_PUBLIC_API_URL: http://localhost:3001
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    ports:
      - "3000:3000"
    depends_on:
      - backend
    command: npm run dev
    networks:
      - app-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  app-network:
    driver: bridge
```

#### Service Dependencies

**Startup Order:**

```
1. postgres (with healthcheck)
   └── Wait for: pg_isready

2. redis (with healthcheck)
   └── Wait for: redis-cli ping

3. backend
   └── Depends on: postgres (healthy), redis (healthy)
   └── Runs: prisma migrate + npm run start:dev

4. frontend
   └── Depends on: backend
   └── Runs: npm run dev
```

**Health Checks:**

```yaml
# PostgreSQL health check
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U app -d payments"]
  interval: 5s
  timeout: 5s
  retries: 5
  start_period: 10s

# Redis health check
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 5s
  timeout: 5s
  retries: 5
```

#### Development Workflow

**Quick Start:**

```bash
# 1. Clone repository
git clone <repo-url>
cd stripe-payment-system

# 2. Copy environment template
cp .env.example .env
# Edit .env with your Stripe keys

# 3. Start all services
docker-compose up -d

# 4. View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# 5. Stop services
docker-compose down

# 6. Reset (delete data volumes)
docker-compose down -v
```

**Environment Variables:**

```bash
# .env.example
# Database
DB_USER=app
DB_PASSWORD=devpassword

# Stripe (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET=change-this-in-production

# Application
NODE_ENV=development
```

#### Dockerfile Best Practices

**Backend Dockerfile:**

```dockerfile
# backend/Dockerfile
FROM node:20-alpine

# Install dependencies for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install

# Copy prisma schema for migration
COPY prisma ./prisma/

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Expose port
EXPOSE 3001

# Start application
CMD ["pnpm", "start:dev"]
```

**Frontend Dockerfile:**

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
```

#### Volume Management

**Persistent Data:**

```yaml
volumes:
  postgres_data:
    driver: local
    # Data persists between container restarts
    # Location: /var/lib/docker/volumes/stripe-payment-system_postgres_data

  redis_data:
    driver: local
    # Redis append-only file persistence
```

**Development Bind Mounts:**

```yaml
# Hot reload for development
volumes:
  - ./backend:/app        # Mount source code
  - /app/node_modules     # Anonymous volume (preserve container's node_modules)
```

#### Networking

**Service Communication:**

```
Container Name Resolution:
- postgres → resolves to PostgreSQL container IP
- redis → resolves to Redis container IP
- backend → resolves to Backend container IP
- frontend → resolves to Frontend container IP

External Access:
- localhost:3000 → Frontend
- localhost:3001 → Backend API
- localhost:5432 → PostgreSQL
- localhost:6379 → Redis
```

**Network Isolation:**

```yaml
networks:
  app-network:
    driver: bridge
    # All services communicate on internal network
    # No external access except exposed ports
```

#### Common Commands

```bash
# Start specific service
docker-compose up -d postgres
docker-compose up -d backend

# View logs
docker-compose logs -f [service]
docker-compose logs --tail=100 backend

# Execute commands in container
docker-compose exec backend sh
docker-compose exec postgres psql -U app -d payments
docker-compose exec redis redis-cli

# Run database migrations
docker-compose exec backend npx prisma migrate dev

# Reset database
docker-compose exec backend npx prisma migrate reset

# View database with Prisma Studio
docker-compose exec backend npx prisma studio

# Rebuild containers
docker-compose up -d --build

# Clean up
docker-compose down -v --remove-orphans
docker system prune -f
```

#### Production Considerations

**Development vs Production:**

| Aspect | Development | Production |
|--------|-------------|------------|
| **Node Environment** | `development` | `production` |
| **Hot Reload** | ✅ Enabled | ❌ Disabled |
| **Debug Logging** | ✅ Verbose | ❌ Minimal |
| **SSL** | ❌ HTTP | ✅ HTTPS |
| **Secrets** | `.env` file | Secrets manager |
| **Database** | Local container | Managed service |
| **Redis** | Local container | Managed service |
| **Scaling** | Single container | Multiple replicas |

**Production Migration:**

```yaml
# Production uses orchestration (Kubernetes/ECS)
# Docker Compose is for local development only

# Key differences:
# 1. Use managed PostgreSQL (RDS, Cloud SQL)
# 2. Use managed Redis (ElastiCache, Memorystore)
# 3. Secrets from AWS Secrets Manager / Azure Key Vault
# 4. Load balancer in front of backend
# 5. CDN for frontend static assets
```

**Key Insight:** Docker Compose ensures every developer has the same environment. No "works on my machine" issues. New team members are productive in 5 minutes, not 5 hours. The setup mirrors production architecture (PostgreSQL + Redis + Backend + Frontend) at a smaller scale.

### 8.2 Health Checks & Observability

Observability provides **visibility into system health** through structured logging, metrics, and health checks. This enables proactive issue detection and rapid incident response.

#### Health Check Endpoints

**Endpoint Structure:**

```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
    private stripe: StripeHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.stripe.pingCheck('stripe'),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    // For Kubernetes readiness probe
    // Fails if app can't serve traffic (migrating, warming up)
    return this.health.check([
      () => this.prisma.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }

  @Get('live')
  @HealthCheck()
  liveness() {
    // For Kubernetes liveness probe
    // Fails if app is deadlocked/crashed (should restart)
    return this.health.check([
      () => ({ api: { status: 'up' } }),
    ]);
  }
}
```

**Health Check Responses:**

```json
// GET /health (Healthy)
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "stripe": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up", "responseTime": "45ms" },
    "redis": { "status": "up", "responseTime": "12ms" },
    "stripe": { "status": "up", "responseTime": "234ms" }
  }
}

// GET /health (Unhealthy)
{
  "status": "error",
  "info": {},
  "error": {
    "database": {
      "status": "down",
      "message": "Connection refused"
    }
  },
  "details": {
    "database": {
      "status": "down",
      "message": "Connection refused"
    }
  }
}
```

#### Structured Logging

**Pino Logger Configuration:**

```typescript
// logger.config.ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'password'],
          remove: true,
        },
        customProps: (req) => ({
          userId: req.user?.id,
          requestId: req.id,
        }),
      },
    }),
  ],
})
export class AppModule {}
```

**Log Levels:**

| Level | Use Case | Example |
|-------|----------|---------|
| **TRACE** | Detailed debugging | Function entry/exit |
| **DEBUG** | Development info | Query parameters |
| **INFO** | Normal operations | Payment created |
| **WARN** | Unexpected but handled | Retry attempt |
| **ERROR** | Failed operations | Database connection failed |
| **FATAL** | System crash | Out of memory |

**Logging Best Practices:**

```typescript
// ✅ Good: Structured logging
this.logger.info({
  event: 'PAYMENT_CREATED',
  paymentId: payment.id,
  userId: user.id,
  amount: payment.amount,
  currency: payment.currency,
}, 'Payment created successfully');

// ❌ Bad: String interpolation
this.logger.info(`Payment ${payment.id} created for user ${user.id}`);

// ✅ Good: Error with context
this.logger.error({
  event: 'PAYMENT_FAILED',
  paymentId: payment.id,
  error: error.message,
  stack: error.stack,
  userId: user.id,
}, 'Payment processing failed');

// ❌ Bad: console.log
console.log('Payment failed:', error);
```

#### Request Logging

**Automatic Request/Response Logging:**

```typescript
// middleware/request-logger.middleware.ts
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      this.logger.info({
        event: 'HTTP_REQUEST',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userId: req.user?.id,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
    });

    next();
  }
}
```

#### Metrics Collection

**Prometheus Metrics:**

```typescript
// metrics.service.ts
@Injectable()
export class MetricsService {
  private readonly httpRequestDuration: Histogram;
  private readonly httpRequestsTotal: Counter;
  private readonly activeConnections: Gauge;

  constructor() {
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
    });

    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
    });
  }

  recordRequest(duration: number, labels: Record<string, string>) {
    this.httpRequestDuration.observe(labels, duration);
    this.httpRequestsTotal.inc(labels);
  }

  setActiveConnections(count: number) {
    this.activeConnections.set(count);
  }
}
```

**Business Metrics:**

```typescript
// Business metrics tracking
@Injectable()
export class BusinessMetricsService {
  private readonly paymentsCreated: Counter;
  private readonly paymentsSucceeded: Counter;
  private readonly paymentsFailed: Counter;
  private readonly paymentAmount: Histogram;

  constructor() {
    this.paymentsCreated = new Counter({
      name: 'payments_created_total',
      help: 'Total number of payments created',
      labelNames: ['currency'],
    });

    this.paymentsSucceeded = new Counter({
      name: 'payments_succeeded_total',
      help: 'Total number of successful payments',
      labelNames: ['currency'],
    });

    this.paymentsFailed = new Counter({
      name: 'payments_failed_total',
      help: 'Total number of failed payments',
      labelNames: ['currency', 'error_code'],
    });

    this.paymentAmount = new Histogram({
      name: 'payment_amount_usd',
      help: 'Payment amounts in USD',
      buckets: [10, 50, 100, 500, 1000, 5000, 10000],
    });
  }

  recordPaymentCreated(amount: number, currency: string) {
    this.paymentsCreated.inc({ currency });
    this.paymentAmount.observe(amount);
  }

  recordPaymentSucceeded(currency: string) {
    this.paymentsSucceeded.inc({ currency });
  }

  recordPaymentFailed(currency: string, errorCode: string) {
    this.paymentsFailed.inc({ currency, error_code: errorCode });
  }
}
```

#### Alerting Rules

**Critical Alerts:**

```yaml
# alerts.yml
groups:
  - name: payment_system
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      # Database connection failures
      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database is down"
          description: "PostgreSQL has been down for more than 1 minute"

      # Payment success rate drop
      - alert: LowPaymentSuccessRate
        expr: rate(payments_succeeded_total[5m]) / rate(payments_created_total[5m]) < 0.95
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Payment success rate is low"
          description: "Success rate has dropped below 95%"

      # Webhook processing delays
      - alert: WebhookProcessingDelay
        expr: time() - webhook_last_processed_timestamp > 300
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Webhook processing delayed"
          description: "Webhooks haven't been processed in 5 minutes"

      # Memory usage
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90%"
```

#### Distributed Tracing

**OpenTelemetry Integration:**

```typescript
// tracing.config.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Custom spans
@Injectable()
export class PaymentsService {
  async createPayment(dto: CreatePaymentDto) {
    return tracer.startActiveSpan('create-payment', async (span) => {
      try {
        span.setAttribute('payment.amount', dto.amount);
        span.setAttribute('payment.currency', dto.currency);

        const payment = await this.processPayment(dto);

        span.setAttribute('payment.id', payment.id);
        span.setStatus({ code: SpanStatusCode.OK });

        return payment;
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

#### Log Aggregation

**ELK Stack (Elasticsearch, Logstash, Kibana):**

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  logstash:
    image: logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: kibana:8.11.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

**Logstash Configuration:**

```conf
# logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  json {
    source => "message"
  }

  date {
    match => ["timestamp", "ISO8601"]
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "payment-logs-%{+YYYY.MM.dd}"
  }
}
```

#### Dashboards

**Grafana Dashboard:**

```json
{
  "dashboard": {
    "title": "Payment System",
    "panels": [
      {
        "title": "Payment Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(payments_succeeded_total[5m]) / rate(payments_created_total[5m])"
          }
        ],
        "thresholds": [
          { "color": "red", "value": 0.9 },
          { "color": "yellow", "value": 0.95 },
          { "color": "green", "value": 0.99 }
        ]
      },
      {
        "title": "Request Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

**Key Insight:** Observability is not optional for payment systems. When something goes wrong, you need to know immediately what happened and why. Health checks enable automatic recovery, structured logging enables debugging, and metrics enable proactive alerting. Invest in observability early—it pays dividends during incidents.

### 8.3 Database Migration Flow

Database migrations manage **schema changes safely** across environments, ensuring data integrity and zero-downtime deployments.

#### Migration Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MIGRATION WORKFLOW                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DEVELOPMENT                                                             │
│  ├── Modify schema.prisma                                               │
│  ├── Run: prisma migrate dev --name <description>                       │
│  ├── Review generated migration SQL                                     │
│  ├── Test migration locally                                             │
│  └── Commit migration file                                               │
│                                                                         │
│  CODE REVIEW                                                             │
│  ├── PR includes migration file                                         │
│  ├── Review SQL for safety (locks, duration)                            │
│  ├── Check backward compatibility                                       │
│  └── Approve or request changes                                          │
│                                                                         │
│  STAGING                                                                 │
│  ├── Deploy to staging environment                                      │
│  ├── Run: prisma migrate deploy                                         │
│  ├── Verify application works                                           │
│  └── Run integration tests                                               │
│                                                                         │
│  PRODUCTION                                                              │
│  ├── Schedule maintenance window (if needed)                            │
│  ├── Backup database                                                     │
│  ├── Run: prisma migrate deploy                                         │
│  ├── Verify migration success                                           │
│  ├── Monitor for errors                                                 │
│  └── Rollback if needed (rare)                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Prisma Migration Commands

**Development:**

```bash
# Create migration from schema changes
npx prisma migrate dev --name add_user_preferences

# Apply migrations to local database
npx prisma migrate dev

# Reset database (destructive - deletes data)
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

**Production:**

```bash
# Apply pending migrations (production-safe)
npx prisma migrate deploy

# Validate schema matches database
npx prisma migrate resolve --applied 20240115120000_add_user_preferences

# Mark migration as rolled back (emergency only)
npx prisma migrate resolve --rolled-back 20240115120000_add_user_preferences
```

#### Migration File Structure

```
prisma/
├── schema.prisma              # Current schema definition
├── migrations/
│   ├── 20240115120000_init/
│   │   └── migration.sql      # Initial schema
│   ├── 20240116130000_add_user_preferences/
│   │   └── migration.sql      # Add preferences column
│   ├── 20240117140000_create_subscriptions/
│   │   └── migration.sql      # New subscriptions table
│   └── migration_lock.toml    # Migration tracking
```

**Example Migration:**

```sql
-- 20240116130000_add_user_preferences/migration.sql
-- Add preferences column to users table

-- Check if column exists (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'preferences'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "preferences" JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create index for JSON queries
CREATE INDEX IF NOT EXISTS "users_preferences_idx" ON "users" USING GIN ("preferences");
```

#### Safe Migration Patterns

**Adding Columns:**

```sql
-- ✅ Safe: Add nullable column
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(20);

-- ✅ Safe: Add column with default
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN DEFAULT false;

-- ⚠️  Caution: Add non-nullable column without default
-- Requires: table rewrite, long lock
ALTER TABLE "users" ADD COLUMN "required_field" VARCHAR(255) NOT NULL;
-- Better: Add nullable, backfill, then set NOT NULL in separate migration
```

**Modifying Columns:**

```sql
-- ✅ Safe: Increase varchar size
ALTER TABLE "users" ALTER COLUMN "name" TYPE VARCHAR(255);

-- ⚠️  Caution: Decrease varchar size
-- Check existing data fits new size first
ALTER TABLE "users" ALTER COLUMN "name" TYPE VARCHAR(100);

-- ❌ Dangerous: Change column type
-- Requires: table rewrite, long lock
ALTER TABLE "payments" ALTER COLUMN "amount" TYPE DECIMAL(12,2);
-- Better: Add new column, migrate data, drop old column
```

**Creating Indexes:**

```sql
-- ✅ Safe: Create index concurrently (PostgreSQL)
-- Run outside transaction to avoid locking table
CREATE INDEX CONCURRENTLY "payments_user_id_idx" ON "payments"("user_id");

-- ❌ Dangerous: Create index without CONCURRENTLY
-- Locks table for writes during creation
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");
```

**Dropping Columns:**

```sql
-- ✅ Safe: Drop column (PostgreSQL doesn't reclaim space immediately)
ALTER TABLE "users" DROP COLUMN "deprecated_field";

-- ✅ Safer: Two-step process for large tables
-- Step 1: Mark column as ignored (application stops using it)
-- Step 2: Drop column in later migration
```

#### Backward Compatibility

**Zero-Downtime Migrations:**

```
Migration Strategy for Zero Downtime:

1. ADD COLUMN (nullable)
   ├── Deploy: Add column to database
   └── App: Ignores new column (backward compatible)

2. DEPLOY CODE
   ├── Deploy: App code starts writing to new column
   └── App: Reads from old column (fallback logic)

3. BACKFILL DATA
   ├── Run: Update existing rows with new column data
   └── App: Continues working (both columns have data)

4. SWITCH READS
   ├── Deploy: App code reads from new column
   └── App: Still writes to both (safe rollback)

5. REMOVE OLD COLUMN
   ├── Deploy: Stop writing to old column
   └── Migration: Drop old column
```

**Example: Adding Email Verification:**

```typescript
// Migration 1: Add column (nullable)
// 20240115120000_add_email_verified/migration.sql
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN DEFAULT false;

// Application code (backward compatible)
// Both old and new code work
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    // email_verified is optional, defaults to false
  },
});

// Migration 2: Make required (after all data backfilled)
// 20240116130000_make_email_verified_required/migration.sql
ALTER TABLE "users" ALTER COLUMN "email_verified" SET NOT NULL;
```

#### Migration Safety Checklist

Before deploying to production:

- [ ] Migration reviewed by another developer
- [ ] SQL inspected for long-running operations
- [ ] Indexes use CONCURRENTLY (PostgreSQL)
- [ ] Backward compatible with current code
- [ ] Rollback plan documented
- [ ] Database backup completed
- [ ] Migration tested on production-like data
- [ ] Maintenance window scheduled (if needed)
- [ ] Monitoring alerts configured

#### Migration Performance

**Estimating Migration Duration:**

```sql
-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('users'));

-- Check row count
SELECT COUNT(*) FROM users;

-- Estimate index creation time
-- Rule of thumb: ~1 minute per 10 million rows
```

**Large Table Strategies:**

```sql
-- For tables > 10M rows, use pt-online-schema-change (Percona)
-- or pg-online-schema-change (PostgreSQL)

-- Alternative: Batch updates
DO $$
DECLARE
    batch_size INT := 1000;
    rows_updated INT;
BEGIN
    LOOP
        UPDATE "users"
        SET "new_column" = "old_column"
        WHERE "new_column" IS NULL
        AND "id" IN (
            SELECT "id" FROM "users"
            WHERE "new_column" IS NULL
            LIMIT batch_size
        );

        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        EXIT WHEN rows_updated = 0;

        COMMIT;
        PERFORM pg_sleep(0.1); -- Brief pause between batches
    END LOOP;
END $$;
```

#### Rollback Procedures

**When Rollback is Needed:**

```bash
# 1. Stop application deployments
docker-compose stop backend

# 2. Assess situation
# - Check error logs
# - Identify failing migration

# 3. If migration failed mid-way
# Prisma migrations are transactional (PostgreSQL)
# Failed migrations roll back automatically

# 4. If application issues after migration
# Option A: Fix forward (preferred)
# - Create new migration to fix issue
# - Deploy fix

# Option B: Rollback (emergency only)
# - Restore from backup
# - Or use prisma migrate resolve --rolled-back

# 5. Communicate
# - Notify team
# - Update incident log
```

**Emergency Rollback:**

```sql
-- Manual rollback (use with extreme caution)
-- Only if migration was catastrophic

-- Reverse the migration manually
ALTER TABLE "users" DROP COLUMN "new_column";

-- Mark as rolled back in Prisma
-- npx prisma migrate resolve --rolled-back 20240115120000_add_new_column
```

#### Migration Monitoring

**Track Migration Metrics:**

```typescript
// migration.service.ts
@Injectable()
export class MigrationService {
  async logMigrationStart(migrationName: string) {
    await this.logger.info({
      event: 'MIGRATION_START',
      migration: migrationName,
      timestamp: new Date().toISOString(),
    });
  }

  async logMigrationComplete(migrationName: string, duration: number) {
    await this.logger.info({
      event: 'MIGRATION_COMPLETE',
      migration: migrationName,
      duration,
      timestamp: new Date().toISOString(),
    });

    // Alert if migration took too long
    if (duration > 60000) { // 1 minute
      await this.alerts.send({
        severity: 'warning',
        message: `Migration ${migrationName} took ${duration}ms`,
      });
    }
  }
}
```

**Key Insight:** Database migrations are risky operations. Always review the generated SQL, test on production-like data, and have a rollback plan. Prefer multiple small migrations over one large migration. Never modify existing migration files after they've been committed—create new migrations instead.

---

## 9. Common Patterns & Anti-Patterns

### 9.1 Patterns We Follow

Consistent patterns make the codebase **predictable, maintainable, and scalable**. These are the patterns we use throughout the application.

#### NestJS Patterns

**Guards (Authorization):**

```typescript
// Pattern: Guards for authentication/authorization
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const payload = await this.jwtService.verify(token);
    request.user = payload;

    return true;
  }
}

// Usage
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {}
```

**Interceptors (Cross-Cutting Concerns):**

```typescript
// Pattern: Interceptors for logging, transformation, error handling
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

// Global error handling
@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        // Log error
        this.logger.error(err);

        // Transform to standard error response
        throw new HttpException(
          {
            status: err.status || 500,
            message: err.message || 'Internal server error',
            path: context.switchToHttp().getRequest().url,
          },
          err.status || 500,
        );
      }),
    );
  }
}
```

**DTOs (Data Transfer Objects):**

```typescript
// Pattern: DTOs for request/response validation
export class CreatePaymentDto {
  @IsInt()
  @Min(50)
  amount: number;

  @IsString()
  @IsIn(['usd', 'eur', 'gbp'])
  currency: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class PaymentResponseDto {
  id: string;
  amount: number;
  currency: string;
  status: string;

  constructor(payment: Payment) {
    this.id = payment.id;
    this.amount = payment.amount;
    this.currency = payment.currency;
    this.status = payment.status;
  }
}
```

**Decorators (Custom Metadata):**

```typescript
// Pattern: Custom decorators for common metadata
export const User = createParamDecorator(
  (data: keyof JWTPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

// Usage
@Get('profile')
async getProfile(@User() user: JWTPayload) {
  return this.usersService.findById(user.sub);
}

// Or get specific field
@Get('profile')
async getProfile(@User('email') email: string) {
  return this.usersService.findByEmail(email);
}
```

#### Service Layer Patterns

**Single Responsibility:**

```typescript
// Pattern: Each service has one responsibility
@Injectable()
export class PaymentsService {
  // Only payment-related logic
  async createPayment(dto: CreatePaymentDto, user: User) {
    // ...
  }

  async refundPayment(paymentId: string, amount?: number) {
    // ...
  }
}

@Injectable()
export class SubscriptionsService {
  // Only subscription-related logic
  async createSubscription(dto: CreateSubscriptionDto, user: User) {
    // ...
  }
}
```

**Dependency Injection:**

```typescript
// Pattern: Constructor injection for dependencies
@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private logger: LoggerService,
    private mailService: MailService,
  ) {}

  // Services are testable with mocked dependencies
}
```

**Result Pattern (Error Handling):**

```typescript
// Pattern: Explicit error handling with Result type
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

@Injectable()
export class PaymentsService {
  async createPayment(
    dto: CreatePaymentDto,
    user: User,
  ): Promise<Result<Payment, PaymentError>> {
    try {
      const payment = await this.prisma.payment.create({
        data: { /* ... */ },
      });

      return { success: true, data: payment };
    } catch (error) {
      this.logger.error('Payment creation failed', error);

      return {
        success: false,
        error: {
          code: 'PAYMENT_CREATION_FAILED',
          message: 'Failed to create payment',
          originalError: error,
        },
      };
    }
  }
}

// Usage
const result = await paymentsService.createPayment(dto, user);

if (result.success) {
  // Handle success
  console.log(result.data);
} else {
  // Handle error
  console.error(result.error);
}
```

#### Repository Pattern

**Prisma as Repository:**

```typescript
// Pattern: Prisma abstracts database access
@Injectable()
export class PaymentsRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  async findByUserId(userId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreatePaymentInput): Promise<Payment> {
    return this.prisma.payment.create({ data });
  }

  async update(
    id: string,
    data: UpdatePaymentInput,
  ): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id },
      data,
    });
  }
}
```

#### Testing Patterns

**AAA (Arrange-Act-Assert):**

```typescript
describe('PaymentsService', () => {
  it('should create payment', async () => {
    // Arrange
    const dto = createPaymentDtoFactory();
    const user = createUserFactory();
    stripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

    // Act
    const result = await service.createPayment(dto, user);

    // Assert
    expect(result.clientSecret).toBeDefined();
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: dto.amount,
        currency: dto.currency,
      }),
    );
  });
});
```

**Factory Pattern:**

```typescript
// Pattern: Factories for test data
export function createUserFactory(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'user',
    ...overrides,
  };
}

// Usage
const user = createUserFactory({ role: 'admin' });
const payment = createPaymentFactory({ status: 'succeeded' });
```

**Mocking:**

```typescript
// Pattern: Mock external dependencies
const mockStripeService = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
};

beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentsService,
      { provide: StripeService, useValue: mockStripeService },
    ],
  }).compile();
});
```

#### Error Handling Patterns

**Global Exception Filter:**

```typescript
// Pattern: Centralized error handling
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    // Log error
    this.logger.error({
      status,
      message,
      path: request.url,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Send response
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

**Custom Exceptions:**

```typescript
// Pattern: Domain-specific exceptions
export class PaymentFailedException extends HttpException {
  constructor(errorCode: string, message: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'PAYMENT_FAILED',
        code: errorCode,
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InsufficientFundsException extends PaymentFailedException {
  constructor() {
    super('INSUFFICIENT_FUNDS', 'Your card has insufficient funds');
  }
}
```

#### Configuration Patterns

**Environment-based Config:**

```typescript
// Pattern: Type-safe configuration
export const config = {
  database: {
    url: process.env.DATABASE_URL!,
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },
  redis: {
    url: process.env.REDIS_URL!,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: '15m',
  },
} as const;

// Validation on startup
export function validateConfig() {
  const required = ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'JWT_SECRET'];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
```

**Key Insight:** Patterns exist to make code predictable. When every developer follows the same patterns, anyone can understand and modify any part of the codebase. Patterns are conventions—follow them unless you have a compelling reason not to.

### 9.2 Anti-Patterns to Avoid

Anti-patterns are **common mistakes** that lead to technical debt, bugs, and maintenance nightmares. Avoid these at all costs.

#### Type Safety Anti-Patterns

**Using `any`:**

```typescript
// ❌ BAD: Using any loses type safety
async function processPayment(data: any) {
  const payment = await stripe.paymentIntents.create({
    amount: data.amount, // No autocomplete, no type checking
    currency: data.currency,
  });
  return payment;
}

// ✅ GOOD: Use proper types
interface CreatePaymentInput {
  amount: number;
  currency: Currency;
}

async function processPayment(data: CreatePaymentInput) {
  const payment = await stripe.paymentIntents.create({
    amount: data.amount, // Autocomplete works, type checking enforced
    currency: data.currency,
  });
  return payment;
}
```

**Type Assertions Without Validation:**

```typescript
// ❌ BAD: Blind type assertion
const user = req.user as User; // Could be anything!

// ✅ GOOD: Validate before asserting
if (!isUser(req.user)) {
  throw new UnauthorizedException('Invalid user');
}
const user = req.user as User;

// Or use type guards
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}
```

**Non-Null Assertions:**

```typescript
// ❌ BAD: Assuming value exists
const user = await prisma.user.findUnique({ where: { id } });
console.log(user.email); // Runtime error if user is null!

// ✅ GOOD: Check for null
const user = await prisma.user.findUnique({ where: { id } });
if (!user) {
  throw new NotFoundException('User not found');
}
console.log(user.email); // Safe now
```

#### Logging Anti-Patterns

**Using console.log:**

```typescript
// ❌ BAD: console.log in production
console.log('Payment created:', payment);

// ✅ GOOD: Use structured logger
this.logger.info({
  event: 'PAYMENT_CREATED',
  paymentId: payment.id,
  amount: payment.amount,
}, 'Payment created');
```

**Logging Sensitive Data:**

```typescript
// ❌ BAD: Logging sensitive data
this.logger.info('User login', { password: user.password }); // NEVER!

// ✅ GOOD: Redact sensitive data
this.logger.info('User login', { userId: user.id, email: user.email });
```

#### Database Anti-Patterns

**N+1 Queries:**

```typescript
// ❌ BAD: N+1 query problem
const users = await prisma.user.findMany();

for (const user of users) {
  // This runs N queries!
  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
  });
  user.payments = payments;
}

// ✅ GOOD: Single query with include
const users = await prisma.user.findMany({
  include: { payments: true },
});
// Single query with JOIN
```

**Missing Transactions:**

```typescript
// ❌ BAD: Partial updates possible
await prisma.payment.create({ data: { amount: 100 } });
await prisma.invoice.create({ data: { paymentId: '...' } });
// If second fails, payment exists without invoice!

// ✅ GOOD: Use transactions
await prisma.$transaction([
  prisma.payment.create({ data: { amount: 100 } }),
  prisma.invoice.create({ data: { paymentId: '...' } }),
]);
// Both succeed or both fail
```

**No Connection Pooling:**

```typescript
// ❌ BAD: Creating new connections per request
const prisma = new PrismaClient(); // Don't do this!

// ✅ GOOD: Reuse PrismaClient instance
// prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient {
  // Singleton instance managed by NestJS
}
```

#### API Design Anti-Patterns

**Inconsistent Error Responses:**

```typescript
// ❌ BAD: Inconsistent error formats
// Endpoint 1
{ error: 'Not found' }

// Endpoint 2
{ message: 'User not found', code: 404 }

// Endpoint 3
{ status: 'error', detail: 'Resource not found' }

// ✅ GOOD: Consistent error format
{
  statusCode: 404,
  error: 'NOT_FOUND',
  message: 'User not found',
  path: '/users/123',
  timestamp: '2024-01-15T10:30:00Z'
}
```

**Business Logic in Controllers:**

```typescript
// ❌ BAD: Controller doing too much
@Controller('payments')
export class PaymentsController {
  @Post()
  async create(@Body() dto: CreatePaymentDto) {
    // Validation
    if (dto.amount < 50) {
      throw new BadRequestException('Amount too small');
    }

    // Business logic
    const fee = dto.amount * 0.05;
    const total = dto.amount + fee;

    // Database call
    const payment = await this.prisma.payment.create({
      data: { amount: total, currency: dto.currency },
    });

    // External API call
    await this.stripe.paymentIntents.create({
      amount: total,
      currency: dto.currency,
    });

    // Email
    await this.sendEmail(payment);

    return payment;
  }
}

// ✅ GOOD: Thin controller, fat service
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post()
  async create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }
}
```

#### Security Anti-Patterns

**Storing Secrets in Code:**

```typescript
// ❌ BAD: Hardcoded secrets
const JWT_SECRET = 'my-secret-key'; // NEVER!

// ✅ GOOD: Environment variables
const JWT_SECRET = process.env.JWT_SECRET;
```

**No Input Validation:**

```typescript
// ❌ BAD: Trusting user input
@Post('payments')
async create(@Body() dto: any) { // No validation!
  return this.service.create(dto);
}

// ✅ GOOD: Validate all inputs
@Post('payments')
async create(@Body() dto: CreatePaymentDto) { // Validated by ValidationPipe
  return this.service.create(dto);
}
```

**SQL Injection Risk:**

```typescript
// ❌ BAD: String concatenation in queries
const query = `SELECT * FROM users WHERE email = '${email}'`;
// Vulnerable to SQL injection!

// ✅ GOOD: Parameterized queries (Prisma does this automatically)
const user = await prisma.user.findUnique({
  where: { email },
});
```

#### Testing Anti-Patterns

**Testing Implementation Details:**

```typescript
// ❌ BAD: Testing private methods
const service = new PaymentsService();
const result = service.calculateFee(100); // Private method!

// ✅ GOOD: Test public behavior
const result = await service.createPayment({ amount: 100 }, user);
expect(result.fee).toBe(5);
```

**No Test Isolation:**

```typescript
// ❌ BAD: Shared state between tests
let paymentId: string;

it('should create payment', async () => {
  const payment = await service.createPayment(dto, user);
  paymentId = payment.id; // Shared!
});

it('should get payment', async () => {
  const payment = await service.getPayment(paymentId); // Depends on previous test!
});

// ✅ GOOD: Each test independent
it('should create and get payment', async () => {
  const created = await service.createPayment(dto, user);
  const retrieved = await service.getPayment(created.id);
  expect(retrieved.id).toBe(created.id);
});
```

**Flaky Tests:**

```typescript
// ❌ BAD: Time-dependent test
it('should expire token', async () => {
  const token = await service.createToken();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Flaky!
  expect(service.isExpired(token)).toBe(true);
});

// ✅ GOOD: Mock time or use time travel
it('should expire token', async () => {
  jest.useFakeTimers();
  const token = await service.createToken();
  jest.advanceTimersByTime(16 * 60 * 1000); // 16 minutes
  expect(service.isExpired(token)).toBe(true);
  jest.useRealTimers();
});
```

#### Async/Anti-Patterns

**Floating Promises:**

```typescript
// ❌ BAD: Not awaiting promises
async function processPayments() {
  payments.forEach(async (payment) => { // Floating promise!
    await processPayment(payment);
  });
  console.log('Done'); // Runs before payments processed!
}

// ✅ GOOD: Await all promises
async function processPayments() {
  await Promise.all(
    payments.map(async (payment) => {
      await processPayment(payment);
    })
  );
  console.log('Done'); // Runs after all payments processed
}
```

**Callback Hell:**

```typescript
// ❌ BAD: Nested callbacks
getUser(userId, (err, user) => {
  if (err) { /* handle */ }
  getPayments(user.id, (err, payments) => {
    if (err) { /* handle */ }
    processPayments(payments, (err, result) => {
      if (err) { /* handle */ }
      // ...
    });
  });
});

// ✅ GOOD: Async/await
try {
  const user = await getUser(userId);
  const payments = await getPayments(user.id);
  const result = await processPayments(payments);
} catch (err) {
  // Handle error
}
```

#### General Anti-Patterns

**Magic Numbers:**

```typescript
// ❌ BAD: Magic numbers
if (status === 3) { // What is 3?
  // ...
}

// ✅ GOOD: Named constants
const PAYMENT_STATUS_SUCCEEDED = 3;
if (status === PAYMENT_STATUS_SUCCEEDED) {
  // ...
}

// Or use enums
enum PaymentStatus {
  PENDING = 1,
  PROCESSING = 2,
  SUCCEEDED = 3,
  FAILED = 4,
}
```

**Deep Nesting:**

```typescript
// ❌ BAD: Deep nesting
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      // ...
    }
  }
}

// ✅ GOOD: Early returns
if (!user) return;
if (!user.isActive) return;
if (!user.hasPermission) return;
// ...
```

**God Objects:**

```typescript
// ❌ BAD: God object with everything
class PaymentSystem {
  createPayment() { }
  processRefund() { }
  sendEmail() { }
  generateInvoice() { }
  updateInventory() { }
  notifyWebhook() { }
  // 50 more methods...
}

// ✅ GOOD: Separate responsibilities
class PaymentsService { }
class RefundsService { }
class EmailService { }
class InvoicingService { }
class InventoryService { }
class WebhookService { }
```

**Key Insight:** Anti-patterns are seductive because they offer short-term convenience. Resist the temptation. The cost of fixing anti-patterns grows exponentially with time. Code reviews should catch these—if you see an anti-pattern, speak up.

---

## 10. Onboarding Guide for New Developers

### 10.1 First Day Setup

New developers should be **productive within 30 minutes** of cloning the repository. This guide ensures a smooth onboarding experience.

#### Prerequisites

**Required Software:**

| Software | Version | Installation |
|----------|---------|--------------|
| **Node.js** | 20.x LTS | [nodejs.org](https://nodejs.org) |
| **Docker** | Latest | [docker.com](https://docker.com) |
| **Docker Compose** | Latest | Included with Docker Desktop |
| **Git** | 2.x+ | [git-scm.com](https://git-scm.com) |
| **Stripe CLI** | Latest | [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli) |

**Verify Installation:**

```bash
# Check versions
node --version      # v20.x.x
npm --version       # 10.x.x
docker --version    # 24.x.x
docker-compose --version  # 2.x.x
git --version       # 2.x.x
stripe --version    # 1.x.x
```

#### Step-by-Step Setup

**Step 1: Clone Repository (2 minutes)**

```bash
# Clone the repository
git clone <repo-url>
cd stripe-payment-system

# Verify you're on main branch
git branch
# Output: * main
```

**Step 2: Configure Environment (5 minutes)**

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your favorite editor
# Required variables:
# - STRIPE_SECRET_KEY (from Stripe Dashboard)
# - STRIPE_WEBHOOK_SECRET (we'll generate this)
# - JWT_SECRET (generate with: openssl rand -base64 32)
```

**Get Stripe Keys:**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy **Test mode** keys (NOT Production!)
3. Add to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Step 3: Start Services (10 minutes)**

```bash
# Start all services
docker-compose up -d

# Wait for services to be healthy
docker-compose ps
# All services should show "healthy" status

# View logs to confirm startup
docker-compose logs -f backend
# Look for: "Nest application successfully started"
```

**Step 4: Setup Database (3 minutes)**

```bash
# Run database migrations
docker-compose exec backend npx prisma migrate dev

# Generate Prisma client
docker-compose exec backend npx prisma generate

# (Optional) Seed database with test data
docker-compose exec backend npx prisma db seed
```

**Step 5: Configure Stripe Webhooks (5 minutes)**

```bash
# In a new terminal, start Stripe CLI
stripe login

# Forward webhooks to local backend
stripe listen --forward-to localhost:3001/stripe/webhook

# Copy the webhook signing secret to .env
# Example: whsec_1234567890abcdef...
```

Update `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Step 6: Verify Setup (5 minutes)**

```bash
# Check all services are running
curl http://localhost:3000/health
# Expected: {"status":"ok"}

curl http://localhost:3001/health
# Expected: {"status":"ok","info":{"database":{"status":"up"},...}}

# Open frontend in browser
open http://localhost:3000
# Should see login page
```

#### Development Workflow

**Daily Commands:**

```bash
# Start services (if not running)
docker-compose up -d

# View logs
docker-compose logs -f backend    # Backend logs
docker-compose logs -f frontend   # Frontend logs

# Stop services
docker-compose down

# Reset everything (careful - deletes data!)
docker-compose down -v
```

**Making Code Changes:**

```bash
# Backend code changes are automatically reloaded (hot reload)
# Just save the file and see changes

# Frontend code changes are automatically reloaded
# Next.js dev server handles this

# Run tests
docker-compose exec backend npm test
docker-compose exec frontend npm test
```

#### Troubleshooting

**Issue: Port already in use**

```bash
# Error: "port is already allocated"

# Find what's using port 3000
lsof -i :3000

# Kill process or change port in docker-compose.yml
```

**Issue: Database connection failed**

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Reset database (deletes data!)
docker-compose down -v
docker-compose up -d postgres
docker-compose exec backend npx prisma migrate dev
```

**Issue: Stripe webhook not working**

```bash
# Verify Stripe CLI is running
stripe listen --forward-to localhost:3001/stripe/webhook

# Check webhook secret is set
grep STRIPE_WEBHOOK_SECRET .env

# Test webhook manually
curl -X POST http://localhost:3001/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Issue: Prisma client not found**

```bash
# Regenerate Prisma client
docker-compose exec backend npx prisma generate

# If still failing, check prisma/schema.prisma exists
ls -la backend/prisma/schema.prisma
```

#### IDE Setup

**VS Code Extensions (Recommended):**

| Extension | Purpose |
|-----------|---------|
| **ESLint** | Linting |
| **Prettier** | Code formatting |
| **Prisma** | Prisma schema support |
| **Docker** | Docker integration |
| **Thunder Client** | API testing |
| **GitLens** | Git integration |

**VS Code Settings:**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.workingDirectories": ["./backend", "./frontend"],
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

#### First Tasks

**Verify Your Setup:**

1. [ ] Register a new user account
2. [ ] Log in with the account
3. [ ] Create a test payment (use Stripe test card: 4242424242424242)
4. [ ] View the payment in database
5. [ ] Check webhook was received

**Explore the Codebase:**

1. [ ] Read `README.md`
2. [ ] Review `docs/APP_BUILDING_LOGICAL_FLOW.md` (this document)
3. [ ] Explore backend structure: `backend/src/`
4. [ ] Explore frontend structure: `frontend/app/`
5. [ ] Run the test suite: `npm test`

**Key Insight:** If setup takes longer than 30 minutes, something is wrong. Check the troubleshooting section, ask in Slack #dev-help, or update this documentation with what you learned.

### 10.2 Making Your First Change

Making your first change follows the **Feature → Test → PR** workflow. This ensures quality and maintains codebase integrity.

#### Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DEVELOPMENT WORKFLOW                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. PICK TASK                                                           │
│     ├── Check GitHub Issues (label: "good first issue")                 │
│     ├── Or ask in Slack #dev-tasks                                      │
│     └── Assign issue to yourself                                        │
│                                                                         │
│  2. CREATE BRANCH                                                       │
│     ├── git checkout -b feature/123-short-description                   │
│     └── Branch naming: feature/, bugfix/, hotfix/                       │
│                                                                         │
│  3. WRITE TESTS (TDD)                                                   │
│     ├── Write failing test first                                        │
│     ├── Run test to confirm it fails                                    │
│     └── Commit: "test: add test for X"                                  │
│                                                                         │
│  4. IMPLEMENT FEATURE                                                   │
│     ├── Write minimal code to pass test                                 │
│     ├── Refactor if needed                                              │
│     └── Commit: "feat: implement X"                                     │
│                                                                         │
│  5. VERIFY                                                              │
│     ├── Run full test suite: npm test                                   │
│     ├── Check linting: npm run lint                                     │
│     ├── Check types: npm run typecheck                                  │
│     └── Manual testing if needed                                        │
│                                                                         │
│  6. COMMIT & PUSH                                                       │
│     ├── git add .                                                       │
│     ├── git commit (follow commit conventions)                            │
│     └── git push origin feature/123-short-description                   │
│                                                                         │
│  7. CREATE PR                                                           │
│     ├── Open GitHub PR                                                  │
│     ├── Fill out PR template                                            │
│     ├── Link related issue: Closes #123                                 │
│     └── Request review from team                                        │
│                                                                         │
│  8. CODE REVIEW                                                         │
│     ├── Address reviewer comments                                       │
│     ├── Push fixes as separate commits                                  │
│     └── Re-request review when ready                                    │
│                                                                         │
│  9. MERGE                                                               │
│     ├── Squash and merge to main                                        │
│     └── Delete branch after merge                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Example

**Scenario: Add "payment description" field**

**Step 1: Create Branch**

```bash
# Make sure you're on latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/456-add-payment-description
```

**Step 2: Write Tests (TDD)**

```typescript
// payments.service.spec.ts
describe('createPayment', () => {
  it('should accept description field', async () => {
    // Arrange
    const dto = {
      amount: 2000,
      currency: 'usd',
      description: 'Monthly subscription', // New field
    };
    const user = createUserFactory();

    // Act
    const result = await service.createPayment(dto, user);

    // Assert
    expect(result.description).toBe('Monthly subscription');
  });

  it('should validate description length', async () => {
    const dto = {
      amount: 2000,
      currency: 'usd',
      description: 'a'.repeat(501), // Too long
    };

    await expect(service.createPayment(dto, user))
      .rejects
      .toThrow('Description must be 500 characters or less');
  });
});
```

Run test to confirm it fails:

```bash
npm test -- payments.service.spec.ts
# Expected: FAIL (description field doesn't exist yet)
```

Commit the test:

```bash
git add .
git commit -m "test: add tests for payment description field

- Test that description is accepted
- Test description length validation

Related to #456"
```

**Step 3: Implement Feature**

Update DTO:

```typescript
// dto/create-payment.dto.ts
export class CreatePaymentDto {
  @IsInt()
  @Min(50)
  amount: number;

  @IsString()
  @IsIn(['usd', 'eur', 'gbp'])
  currency: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string; // New field
}
```

Update Service:

```typescript
// payments.service.ts
async createPayment(dto: CreatePaymentDto, user: User) {
  const payment = await this.prisma.payment.create({
    data: {
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description, // New field
      userId: user.id,
    },
  });

  return payment;
}
```

Update Database Schema:

```prisma
// schema.prisma
model Payment {
  id          String   @id @default(uuid())
  amount      Int
  currency    String
  description String?  // New field
  status      String
  userId      String
  createdAt   DateTime @default(now())
}
```

Generate migration:

```bash
docker-compose exec backend npx prisma migrate dev --name add_payment_description
```

Run tests to confirm they pass:

```bash
npm test -- payments.service.spec.ts
# Expected: PASS
```

Commit the implementation:

```bash
git add .
git commit -m "feat: add payment description field

- Add optional description field to payments
- Validate max length of 500 characters
- Update database schema with migration

Closes #456"
```

**Step 4: Verify**

```bash
# Run full test suite
npm test

# Check linting
npm run lint

# Check TypeScript
npm run typecheck

# Manual test
curl -X POST http://localhost:3001/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 2000, "currency": "usd", "description": "Test payment"}'
```

**Step 5: Push & Create PR**

```bash
# Push branch
git push origin feature/456-add-payment-description

# Create PR via GitHub CLI or web interface
gh pr create --title "feat: add payment description field" \
  --body "Closes #456

## Changes
- Added optional description field to payments
- Added validation for max length (500 chars)
- Added database migration

## Testing
- Unit tests added
- Manual testing completed
- All existing tests pass"
```

#### Commit Message Conventions

**Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

| Type | Description | Example |
|------|-------------|---------|
| **feat** | New feature | `feat: add payment description` |
| **fix** | Bug fix | `fix: correct refund calculation` |
| **test** | Tests only | `test: add payment validation tests` |
| **refactor** | Code restructuring | `refactor: simplify payment service` |
| **docs** | Documentation | `docs: update API documentation` |
| **chore** | Maintenance | `chore: update dependencies` |

**Examples:**

```bash
# Good commit messages
git commit -m "feat(payments): add support for partial refunds

- Calculate available refund amount
- Validate against already refunded amount
- Update payment status to partial_refunded

Closes #234"

git commit -m "fix(auth): resolve token refresh race condition

- Add locking mechanism to prevent concurrent refreshes
- Invalidate old tokens atomically

Fixes #567"

git commit -m "test(webhooks): add idempotency tests

- Test duplicate webhook handling
- Test concurrent webhook processing

Related to #890"
```

#### PR Template

```markdown
## Description
Brief description of changes

## Related Issue
Closes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] All tests pass

## Screenshots (if applicable)
```

#### Code Review Guidelines

**As Author:**

- [ ] PR is small and focused (ideally < 400 lines)
- [ ] Tests are included
- [ ] Description explains what and why
- [ ] Linked to related issue
- [ ] CI checks pass

**As Reviewer:**

- [ ] Understand the change
- [ ] Check for anti-patterns
- [ ] Verify tests cover edge cases
- [ ] Check for security issues
- [ ] Verify documentation updated
- [ ] Approve or request changes

**Review Comments:**

```
# Good review comments

"Consider extracting this logic into a separate function for better readability"

"This could throw if user is null. Should we add a null check?"

"Can we add a test for the error case here?"

"Nit: variable name 'x' is unclear. Consider 'paymentAmount'?"
```

#### Common Mistakes

**Don't:**

- ❌ Commit directly to main
- ❌ Include unrelated changes in PR
- ❌ Leave console.log statements
- ❌ Skip tests for "simple" changes
- ❌ Make PRs too large (>1000 lines)
- ❌ Ignore CI failures

**Do:**

- ✅ Create feature branches
- ✅ Keep PRs focused and small
- ✅ Write tests first (TDD)
- ✅ Update documentation
- ✅ Respond to review comments promptly
- ✅ Squash commits before merge if messy

**Key Insight:** The PR process exists to catch issues before they reach production. Embrace feedback—it's not personal, it's about code quality. Small, focused PRs get reviewed faster and merged sooner.

### 10.3 Code Review Checklist

Code reviews ensure **quality, consistency, and knowledge sharing**. Use this checklist before submitting and when reviewing PRs.

#### Pre-Submission Checklist

**Before Creating PR:**

```markdown
## Code Quality
- [ ] Code follows project style guidelines
- [ ] No `any` types (use proper TypeScript types)
- [ ] No `console.log` statements (use logger)
- [ ] No commented-out code
- [ ] No TODO comments without issue reference
- [ ] Variable names are descriptive
- [ ] Functions are small and focused (< 50 lines)
- [ ] Complex logic has comments explaining "why"

## Testing
- [ ] Tests written for new functionality (TDD)
- [ ] Tests cover edge cases
- [ ] Tests cover error paths
- [ ] All tests pass (`npm test`)
- [ ] Test coverage maintained or improved
- [ ] No flaky tests

## Security
- [ ] No hardcoded secrets
- [ ] Input validation on all endpoints
- [ ] Authentication/authorization checks
- [ ] No SQL injection vulnerabilities
- [ ] Sensitive data not logged
- [ ] Stripe webhooks signature verified

## Performance
- [ ] No N+1 queries
- [ ] Database queries use indexes
- [ ] No memory leaks
- [ ] Async operations properly awaited

## Documentation
- [ ] README updated if needed
- [ ] API documentation updated
- [ ] Comments added for complex logic
- [ ] Changelog updated (if applicable)

## Git
- [ ] Commits follow conventional format
- [ ] Branch is up to date with main
- [ ] Commit messages are descriptive
- [ ] Branch name follows convention
```

#### Reviewer Checklist

**When Reviewing Code:**

```markdown
## Functionality
- [ ] Change does what PR description claims
- [ ] Edge cases handled
- [ ] Error cases handled
- [ ] No obvious bugs

## Code Quality
- [ ] Code is readable and maintainable
- [ ] Follows established patterns
- [ ] No code smells (duplication, god objects)
- [ ] Proper error handling
- [ ] Async/await used correctly

## Testing
- [ ] Tests are comprehensive
- [ ] Tests are readable
- [ ] Test data is realistic
- [ ] Mocking is appropriate

## Security
- [ ] No security vulnerabilities
- [ ] Input properly validated
- [ ] Authorization checks present
- [ ] No sensitive data exposure

## Performance
- [ ] No obvious performance issues
- [ ] Database queries are efficient
- [ ] No unnecessary computations

## Documentation
- [ ] Code is self-documenting where possible
- [ ] Complex logic has comments
- [ ] Public APIs documented
```

#### Review Priority Levels

**Critical (Must Fix):**

- Security vulnerabilities
- Broken functionality
- Missing error handling
- Performance issues
- Test failures

**High (Should Fix):**

- Code duplication
- Poor naming
- Missing edge case tests
- Complex code without comments

**Medium (Consider Fixing):**

- Style inconsistencies
- Minor refactoring suggestions
- Documentation improvements

**Low (Nitpick):**

- Whitespace issues
- Minor naming preferences
- Optional improvements

#### Review Comment Examples

**Critical:**

```
🚨 Security Issue: This endpoint is missing authentication.
Please add @UseGuards(JwtAuthGuard).
```

**High:**

```
❌ This creates an N+1 query. Consider using include:

const users = await prisma.user.findMany({
  include: { payments: true },
});
```

**Medium:**

```
💡 Consider extracting this into a separate function:

async function calculateRefundAmount(payment: Payment) {
  // ...
}
```

**Low:**

```
📝 Nit: variable name `x` is unclear. Consider `paymentAmount`?
```

#### Review Etiquette

**As Author:**

- Respond to all comments (even with 👍)
- Ask questions if feedback is unclear
- Don't take feedback personally
- Thank reviewers for their time
- Resolve conversations after fixing

**As Reviewer:**

- Be respectful and constructive
- Explain why, not just what
- Suggest improvements, don't just criticize
- Acknowledge good code
- Respond promptly
- Approve when ready (don't just "LGTM")

**Example Review Exchange:**

```
Reviewer: "This function is doing too much. Consider splitting into
smaller functions for validation, processing, and notification."

Author: "Good point! I'll extract the validation logic into a
separate function. Should I also move the notification to a
background job?"

Reviewer: "Moving notification to a background job would be great
if it's not critical for the response. That would improve response
time."

Author: "Done! Extracted validation and moved notification to queue.
Please take another look."

Reviewer: "Looks great! Approved."
```

#### Common Review Findings

**Frequently Caught Issues:**

| Issue | Frequency | Severity |
|-------|-----------|----------|
| Missing tests | Very common | Critical |
| `any` types | Common | High |
| `console.log` | Common | Medium |
| N+1 queries | Common | High |
| Missing error handling | Common | Critical |
| Poor variable names | Common | Low |
| No input validation | Uncommon | Critical |
| Security issues | Rare | Critical |

**Review Statistics:**

```
Average PR Size: 250 lines
Average Review Time: 2 hours
Average Comments per PR: 8
Approval Rate: 85%
Changes Requested Rate: 15%
```

#### Post-Review Actions

**After Approval:**

1. Merge PR (squash if multiple commits)
2. Delete branch
3. Verify deployment succeeds
4. Monitor for errors
5. Close related issue

**After Rejection:**

1. Address all comments
2. Push fixes
3. Re-request review
4. Repeat until approved

**Key Insight:** Code review is a quality gate, not a speed bump. The time invested in reviews saves time debugging production issues. Everyone makes mistakes—reviews catch them before users do.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **3D Secure** | Authentication protocol for online card payments (Verified by Visa, Mastercard SecureCode) |
| **ACID** | Atomicity, Consistency, Isolation, Durability - database transaction properties |
| **Chargeback** | Disputed transaction returned to payer |
| **Connected Account** | Stripe account belonging to a seller on a platform |
| **Customer Portal** | Stripe-hosted page for customers to manage billing |
| **DTO** | Data Transfer Object - object for API request/response |
| **Idempotency** | Property where operation produces same result if executed multiple times |
| **KYC** | Know Your Customer - identity verification process |
| **Metered Billing** | Usage-based billing where amount depends on consumption |
| **PaymentIntent** | Stripe object representing intent to collect payment |
| **PCI DSS** | Payment Card Industry Data Security Standard |
| **Proration** | Adjusting charges for partial billing periods |
| **SAQ** | Self-Assessment Questionnaire - PCI compliance form |
| **SetupIntent** | Stripe object for saving payment methods without charging |
| **Stripe Connect** | Platform for marketplace and multi-party payments |
| **Stripe Elements** | Pre-built UI components for secure card input |
| **Subscription** | Recurring billing arrangement |
| **Webhook** | HTTP callback for asynchronous event notification |

## Appendix B: Reference Diagrams

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                      │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │   Browser   │     │  Mobile App │     │   API       │               │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘               │
└─────────┼───────────────────┼───────────────────┼───────────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                            │ HTTPS
┌───────────────────────────┼───────────────────────────────────────────┐
│                           ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CLOUDFLARE / CDN                                                │   │
│  │  • DDoS protection                                               │   │
│  │  • SSL termination                                               │   │
│  │  • Caching                                                       │   │
│  └────────────────────────┬────────────────────────────────────────┘   │
│                           │                                           │
│                           ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  LOAD BALANCER                                                   │   │
│  │  • Health checks                                                 │   │
│  │  • SSL passthrough                                               │   │
│  └────────────────────────┬────────────────────────────────────────┘   │
│                           │                                           │
│  ┌────────────────────────┴────────────────────────────────────────┐   │
│  │  KUBERNETES CLUSTER                                              │   │
│  │                                                                  │   │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │   │
│  │  │  Frontend   │     │   Backend   │     │   Worker    │       │   │
│  │  │  (Next.js)  │────>│  (NestJS)   │────>│   (Bull)    │       │   │
│  │  │  Pods: 3    │     │  Pods: 3    │     │  Pods: 2    │       │   │
│  │  └─────────────┘     └──────┬──────┘     └─────────────┘       │   │
│  │                             │                                   │   │
│  │                             ▼                                   │   │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │   │
│  │  │  PostgreSQL │<────>│    Redis    │<────>│   Stripe    │       │   │
│  │  │  (Primary)  │     │   (Cluster) │     │    API      │       │   │
│  │  └─────────────┘     └─────────────┘     └─────────────┘       │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Payment Flow Sequence

```
User          Frontend        Backend         Stripe          Database
  │              │               │               │               │
  │  1. Click    │               │               │               │
  │────────────>│               │               │               │
  │              │               │               │               │
  │              │  2. POST      │               │               │
  │              │──────────────>│               │               │
  │              │               │               │               │
  │              │               │  3. Create    │               │
  │              │               │──────────────>│               │
  │              │               │               │               │
  │              │               │  4. Return    │               │
  │              │               │<──────────────│               │
  │              │               │               │               │
  │              │               │  5. Save      │               │
  │              │               │──────────────────────────────>│
  │              │               │               │               │
  │              │  6. Return    │               │               │
  │              │<──────────────│               │               │
  │              │               │               │               │
  │  7. Show     │               │               │               │
  │<────────────│               │               │               │
  │              │               │               │               │
  │  8. Enter    │               │               │               │
  │────────────>│               │               │               │
  │              │               │               │               │
  │              │  9. Confirm   │               │               │
  │              │──────────────────────────────>│               │
  │              │               │               │               │
  │              │               │               │  10. Process  │
  │              │               │               │               │
  │              │  11. Success  │               │               │
  │              │<──────────────────────────────│               │
  │              │               │               │               │
  │  12. Done    │               │               │               │
  │<────────────│               │               │               │
  │              │               │               │               │
  │              │               │  13. Webhook  │               │
  │              │               │<──────────────│               │
  │              │               │               │               │
  │              │               │  14. Update   │               │
  │              │               │──────────────────────────────>│
```

### Database Schema (Simplified)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      USER       │     │     PAYMENT     │     │  SUBSCRIPTION   │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────│ userId (FK)     │     │ id (PK)         │
│ email           │     │ id (PK)         │     │ userId (FK)     │◄──┐
│ password        │     │ stripePaymentId │     │ planId (FK)     │   │
│ stripeCustomerId│     │ amount          │     │ status          │   │
│ role            │     │ currency        │     │ currentPeriod   │   │
│ createdAt       │     │ status          │     │ stripeSubId     │   │
└─────────────────┘     │ paidAt          │     └─────────────────┘   │
                        │ refundedAmount  │                           │
                        │ createdAt       │     ┌─────────────────┐   │
                        └─────────────────┘     │      PLAN       │   │
                                                ├─────────────────┤   │
                        ┌─────────────────┐     │ id (PK)         │───┘
                        │     REFUND      │     │ name            │
                        ├─────────────────┤     │ stripePriceId   │
                        │ id (PK)         │     │ amount          │
                        │ paymentId (FK)  │◄────│ currency        │
                        │ amount          │     │ interval        │
                        │ reason          │     └─────────────────┘
                        │ status          │
                        │ createdAt       │
                        └─────────────────┘
```

## Appendix C: Decision Log

| Date | Decision | Context | Alternatives | Rationale |
|------|----------|---------|--------------|-----------|
| 2024-01 | NestJS over Express | Backend framework | Express, Fastify | Enterprise patterns, TypeScript native, DI |
| 2024-01 | Next.js over CRA | Frontend framework | CRA, Remix | API routes, SSR, deployment simplicity |
| 2024-01 | Prisma over TypeORM | ORM | TypeORM, Sequelize | Type safety, migrations, DX |
| 2024-01 | PostgreSQL over MongoDB | Database | MongoDB, MySQL | ACID compliance, relational data |
| 2024-01 | Stripe over Braintree | Payment processor | Braintree, Adyen | Developer experience, features |
| 2024-01 | Docker Compose for local dev | Local setup | Native, Vagrant | Consistency, onboarding speed |
| 2024-02 | Vitest over Jest | Testing | Jest, Mocha | TypeScript native, ESM support, speed |
| 2024-02 | RTK Query over React Query | Data fetching | React Query, SWR | Redux integration, caching |
| 2024-03 | Internal invoicing over Stripe | Invoicing | Stripe Invoicing | Customization, branding control |
| 2024-03 | Result pattern for errors | Error handling | Exceptions only | Explicit handling, type safety |

---

*Document Version: 1.0*  
*Last Updated: 2026-03-16*  
*Maintained by: Engineering Team*
