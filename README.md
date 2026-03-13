# Stripe Payment System

A full-stack payment application with embedded Stripe integration, usage-based billing, and Docker deployment.

## Features

- 🔐 JWT Authentication
- 💳 Save & manage payment methods (cards, bank accounts)
- ⚡ Make instant payments without redirects
- 📧 Email notifications (receipts, billing, password reset)
- 💰 Full & partial refunds
- 🧾 PDF invoice generation
- 🍎 Apple Pay & Google Pay support
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

### Tax Calculation
- `POST /tax/calculate` - Calculate tax for amount with customer address
- `POST /tax/preview` - Preview tax for multiple items
- `POST /tax/verify-id` - Verify VAT/GST tax ID
- `GET /tax/settings` - Get tax settings

### Admin (Requires ADMIN role)
- `GET /admin/dashboard` - Get dashboard summary with metrics
- `GET /admin/metrics` - Get dashboard metrics
- `GET /admin/revenue?period=&days=` - Get revenue by period (day/week/month)
- `GET /admin/transactions?limit=` - Get recent transactions
- `GET /admin/payment-methods` - Get payment method distribution
- `GET /admin/users?page=&limit=&search=` - List users with search
- `GET /admin/users/:id` - Get user details
- `POST /admin/users/:id/suspend` - Suspend user

### Invoices
- `GET /invoices/payment/:id` - Download payment invoice (PDF)
- `GET /invoices/payment/:id/view` - View invoice inline
- `GET /invoices/usage/:id` - Download usage invoice (PDF)

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
- `POST /payments/:id/refund` - Create refund (full or partial)
- `GET /payments/:id/refunds` - List refunds for payment

### Refunds
- `GET /payments/refunds/all` - List all user refunds

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
│  - React 19, Tailwind v4, Stripe.js, RTK Query        │
│  - Embedded Payment Element (no redirects)              │
├─────────────────────────────────────────────────────────┤
│  NestJS Backend (Port 3001)                             │
│  - REST API with JWT auth                               │
│  - Prisma ORM with PostgreSQL                           │
│  - Redis for sessions, rate limiting, idempotency       │
│  - Stripe SDK integration                               │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (Port 5432) - Source of Truth               │
│  Redis (Port 6379) - Cache & Sessions                   │
└─────────────────────────────────────────────────────────┘
```

## Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Success |
| 4000 0027 6000 3184 | Requires 3D Secure |
| 4000 0084 0000 1280 | Insufficient funds |
| 4000 0000 0000 9995 | Declined |

## Apple Pay & Google Pay

To enable Apple Pay and Google Pay:

### 1. Enable in Stripe Dashboard
1. Go to [Stripe Dashboard Settings](https://dashboard.stripe.com/settings/payments)
2. Enable **Apple Pay** and **Google Pay** under "Payment methods"
3. For Apple Pay: Complete domain verification in Production

### 2. Domain Verification (Production Only)
Apple Pay requires domain verification. Place the verification file at:
```
https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association
```

The file can be downloaded from your Stripe Dashboard after enabling Apple Pay.

### 3. Testing
- **Apple Pay**: Test on macOS Safari or iOS Safari (requires Touch ID/Face ID)
- **Google Pay**: Test on Chrome with a saved payment method

Note: Digital wallets appear automatically based on:
- Device/browser capability
- Customer's saved payment methods
- Your Stripe account's enabled payment methods
