# External Integrations

**Analysis Date:** 2026-03-16

## APIs & External Services

**Stripe (Primary Payment Provider):**
- SDK: `stripe` npm package v17.7.0
- API Version: 2025-02-24.acacia
- Auth: `STRIPE_SECRET_KEY` env var
- Features used:
  - Payment Intents (immediate charges)
  - Setup Intents (saving payment methods)
  - Customers (customer management)
  - Subscriptions (recurring billing)
  - Subscription Items (metered billing)
  - Prices & Products (plan management)
  - Promo Codes & Coupons (discounts)
  - Tax Rates (automatic tax calculation)
  - Refunds (full and partial)
  - Disputes (chargeback handling)
  - Connect (marketplace/Platform accounts)
  - Transfers (payouts to connected accounts)
  - Exchange Rates (multi-currency support)
  - Customer Portal (self-service billing)
  - Webhooks (event-driven updates)
- Implementation: `/backend/src/stripe/stripe.service.ts`

**Stripe React (Frontend):**
- SDK: `@stripe/react-stripe-js` v3.6.0, `@stripe/stripe-js` v6.1.0
- Auth: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` env var
- Components: CardElement, PaymentElement (implied)
- Implementation: Frontend payment forms

**Email (SMTP):**
- Library: `nodemailer` v8.0.2
- Template Engine: `handlebars` v4.7.8
- Configuration: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Features:
  - Password reset emails
  - Payment receipts
  - Payment failure notifications
  - Billing summaries
  - Invoice emails with PDF attachments
  - Welcome emails
  - Refund confirmations
  - Subscription notifications (trial ended, canceled, past due)
  - Dispute notifications
- Implementation: `/backend/src/mail/mail.service.ts`

**PDF Generation:**
- Library: `pdfkit` v0.17.2
- Usage: Invoice PDF generation
- Implementation: `/backend/src/invoices/invoice.service.ts`

**Browser Automation:**
- Library: `puppeteer` v24.39.0
- Usage: Likely for PDF generation or testing

## Data Storage

**Primary Database:**
- Type: PostgreSQL 16
- Connection: `DATABASE_URL` env var
- ORM: Prisma Client 6.5.0
- Schema: `/backend/prisma/schema.prisma`
- Migrations: Prisma Migrate
- Key Tables:
  - `users` - User accounts with Stripe customer IDs
  - `payment_methods` - Saved payment methods
  - `payment_records` - Payment transactions
  - `refunds` - Refund records
  - `subscriptions` - Subscription data
  - `plans` / `prices` - Subscription plans
  - `promo_codes` - Discount codes
  - `usage_records` - Metered billing usage
  - `webhook_events` - Stripe webhook events
  - `disputes` - Chargeback records
  - `connected_accounts` - Stripe Connect accounts
  - `transfers` - Payout records

**Cache & Queue:**
- Type: Redis 7
- Connection: `REDIS_URL` env var
- Client: `ioredis` 5.5.0
- Usage:
  - Rate limiting (sliding window)
  - Session storage
  - Idempotency key caching
  - Webhook processing locks
  - Payment intent caching
  - Retry counters
  - Job queue (Bull)
- Implementation: `/backend/src/redis/redis.service.ts`

**Job Queue:**
- Library: Bull 4.16.5 with `@nestjs/bull` 11.0.4
- Backend: Redis
- Usage: Background job processing (currency updates, etc.)
- Implementation: `/backend/src/currency/currency.processor.ts`

## Authentication & Identity

**JWT Authentication:**
- Library: `@nestjs/jwt` 11.0.0, `passport-jwt` 4.0.1
- Strategy: Passport JWT
- Token Storage: HTTP-only cookies + Redis sessions
- Secret: `JWT_SECRET` env var
- Implementation: `/backend/src/auth/`

**Password Hashing:**
- Library: `bcrypt` 5.1.1
- Rounds: Default (10)
- Implementation: `/backend/src/auth/auth.service.ts`

**API Key Authentication:**
- Guard: `ApiKeyGuard` - Global guard for API endpoints
- Header: `X-API-Key`
- Implementation: `/backend/src/common/guards/api-key.guard.ts`

## Monitoring & Observability

**Logging:**
- Framework: NestJS built-in Logger
- Levels: log, error, warn, debug
- Usage: All services use structured logging

**Health Checks:**
- Database: `pg_isready` (Docker)
- Redis: `redis-cli ping` (Docker)
- Application: Implied via Docker healthchecks

## CI/CD & Deployment

**Containerization:**
- Platform: Docker
- Orchestration: Docker Compose
- Services:
  - `postgres` - PostgreSQL 16 Alpine
  - `redis` - Redis 7 Alpine
  - `backend` - NestJS application
  - `frontend` - Next.js application
- Network: Custom bridge network (172.20.0.0/24)

**Build:**
- Backend: `nest build` → `dist/main.js`
- Frontend: `next build` → standalone output

## Environment Configuration

**Required env vars:**
```
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stripe

# Redis
REDIS_URL=redis://:redis@localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_TAX_ENABLED=false

# JWT
JWT_SECRET=your-super-secret-jwt-key

# App URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@example.com
FROM_NAME=Payment System
```

**Secrets location:**
- Development: `.env` file (gitignored)
- Production: Environment variables injected via Docker

## Webhooks & Callbacks

**Incoming (Stripe Webhooks):**
- Endpoint: `POST /stripe/webhook`
- Verification: Stripe signature with `STRIPE_WEBHOOK_SECRET`
- Events handled:
  - `payment_intent.succeeded` - Mark payment successful
  - `payment_intent.payment_failed` - Mark payment failed
  - `payment_intent.requires_action` - 3D Secure required
  - `setup_intent.succeeded` - Payment method saved
  - `setup_intent.setup_failed` - Setup failed
  - `customer.subscription.created` - Subscription created
  - `customer.subscription.updated` - Subscription updated
  - `customer.subscription.deleted` - Subscription canceled
  - `charge.dispute.created` - Chargeback initiated
  - `charge.dispute.updated` - Dispute updated
  - `account.updated` - Connect account updated
- Processing: Redis locks for idempotency
- Storage: All events saved to `webhook_events` table
- Dashboard: Admin interface for monitoring and retry
- Implementation: `/backend/src/webhooks/`

**Outgoing:**
- None (webhook-based architecture)

## Multi-Currency Support

**Exchange Rates:**
- Source: Stripe Exchange Rates API
- Endpoint: `stripe.exchangeRates.list()`
- Base Currency: USD
- Supported: USD, EUR, GBP, CAD, AUD, JPY (and more via Stripe)
- Implementation: `/backend/src/currency/exchange-rate.service.ts`

---

*Integration audit: 2026-03-16*
