# Stripe Payment System

A full-stack payment application with embedded Stripe integration, usage-based billing, and Docker deployment.

## Features

- 🔐 JWT Authentication
- 💳 Save & manage payment methods (cards, bank accounts)
- ⚡ Make instant payments without redirects
- 📧 Email notifications (receipts, billing, password reset)
- 💰 Full & partial refunds
- 🧾 PDF invoice generation (internal system, not Stripe)
- 🍎 Apple Pay & Google Pay support
- 📅 Subscription tiers with recurring billing
- 📊 Usage-based subscriptions (metered billing)
- 🏢 Stripe Customer Portal (self-service billing)
- 💱 Multi-currency support (USD, EUR, GBP, CAD, AUD, JPY)
- 🎟️ Promo codes & discounts
- 📊 Usage-based monthly billing
- 📡 Webhooks Dashboard (monitor delivery & retry)
- ⚔️ Dispute handling (chargebacks)
- 🏪 Stripe Connect (marketplace & platform payments)
- 🐳 Docker Compose setup with PostgreSQL & Redis
- 🔄 Webhook handling with idempotency
- ⏱️ Rate limiting on payment endpoints
- 📦 Tax calculation (US states & EU VAT)

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

### Subscriptions
- `GET /subscriptions/plans` - List available subscription plans
- `GET /subscriptions/plans/:id` - Get plan details
- `POST /subscriptions` - Create new subscription
- `GET /subscriptions` - Get current user's subscriptions
- `PATCH /subscriptions/:id` - Update subscription (upgrade/downgrade)
- `DELETE /subscriptions/:id` - Cancel subscription

### Tax Calculation
- `POST /tax/calculate` - Calculate tax for amount with customer address
- `POST /tax/preview` - Preview tax for multiple items
- `POST /tax/verify-id` - Verify VAT/GST tax ID
- `GET /tax/settings` - Get tax settings

### Customer Portal
- `POST /customer-portal/session` - Create portal session (redirects to Stripe-hosted portal)
- `GET /customer-portal/configuration` - Get portal configuration

### Currency
- `GET /currency` - List supported currencies
- `GET /currency/convert?amount=&from=&to=` - Convert amount between currencies
- `GET /currency/exchange-rates?base=` - Get exchange rates

### Promo Codes
- `GET /promo-codes/validate/:code` - Validate a promo code (public)
- `GET /promo-codes` - List promo codes (admin)
- `POST /promo-codes` - Create promo code (admin)
- `PATCH /promo-codes/:id/deactivate` - Deactivate promo code (admin)
- `DELETE /promo-codes/:id` - Delete promo code (admin)

### Usage-Based Subscriptions (Metered Billing)
- `POST /usage-subscriptions` - Create metered subscription
- `POST /usage-subscriptions/:id/usage` - Record usage
- `GET /usage-subscriptions/:id/usage-summary` - Get usage summary

### Disputes (Chargebacks)
- `GET /disputes` - List all disputes (admin)
- `GET /disputes/my-disputes` - Get user's disputes
- `GET /disputes/stats` - Get dispute statistics (admin)
- `GET /disputes/:id` - Get dispute details
- `POST /disputes/:id/evidence` - Submit dispute evidence (admin)
- `POST /disputes/:id/close` - Close dispute manually (admin)

### Stripe Connect (Marketplace)
- `POST /connect/accounts` - Create connected account
- `GET /connect/account` - Get connected account
- `POST /connect/onboarding-link` - Create onboarding link
- `POST /connect/login-link` - Create Express Dashboard login link
- `POST /connect/direct-charge` - Create direct charge to connected account
- `POST /connect/transfers` - Create transfer (admin)
- `GET /connect/transfers/:connectedAccountId` - Get transfers
- `GET /connect/platform-balance` - Get platform balance (admin)

### Admin (Requires ADMIN role)
- `GET /admin/dashboard` - Get dashboard summary with metrics
- `GET /admin/metrics` - Get dashboard metrics
- `GET /admin/revenue?period=&days=` - Get revenue by period (day/week/month)
- `GET /admin/transactions?limit=` - Get recent transactions
- `GET /admin/payment-methods` - Get payment method distribution
- `GET /admin/users?page=&limit=&search=` - List users with search
- `GET /admin/users/:id` - Get user details
- `POST /admin/users/:id/suspend` - Suspend user
- `GET /admin/webhooks/stats` - Webhook statistics
- `GET /admin/webhooks/events` - List webhook events
- `GET /admin/webhooks/events/:id` - Get webhook event details
- `POST /admin/webhooks/events/:id/retry` - Retry failed webhook
- `GET /admin/webhooks/errors` - Recent webhook errors

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

## Invoicing

This system uses **internal invoicing** (not Stripe's invoice system):

- PDF invoices are generated locally using Puppeteer
- Invoices are sent via email using Nodemailer
- Invoice data is stored in the database
- Stripe is only used for payment processing, not invoice delivery

To download an invoice:
```bash
GET /invoices/payment/:id       # Download payment invoice (PDF)
GET /invoices/usage/:id         # Download usage invoice (PDF)
```

## Multi-Currency Support

The system supports 6 currencies with automatic detection and user preferences:

### Supported Currencies
- **USD** 🇺🇸 - US Dollar (default)
- **EUR** 🇪🇺 - Euro
- **GBP** 🇬🇧 - British Pound
- **CAD** 🇨🇦 - Canadian Dollar
- **AUD** 🇦🇺 - Australian Dollar
- **JPY** 🇯🇵 - Japanese Yen

### Features
- **Auto-detection**: Currency detected from user's IP location on first visit
- **User preference**: Currency saved to user profile and used across sessions
- **Quick switcher**: Change currency from navbar dropdown
- **USD transparency**: USD equivalent shown for price transparency
- **Exchange rates**: Real-time conversion with daily rate updates

### API Endpoints
```bash
GET /currency                    # List supported currencies
GET /currency/detect             # Detect currency from IP
GET /currency/convert            # Convert between currencies
GET /currency/health             # Health check for exchange rates
PATCH /auth/preferred-currency   # Update user's currency preference
PATCH /auth/country              # Update user's country (auto-suggests currency)
```

## Production Configuration

### Exchange Rates
The system uses **Stripe's Exchange Rates API** for real-time rates:
- Rates are cached in Redis for 1 hour
- Daily background job refreshes rates at midnight UTC via Bull queue
- Fallback to static rates if API is unavailable
- No additional API key required (uses existing Stripe key)

### Currency Detection
Users select their **country** during registration or in settings:
- Country is stored in user profile (ISO 3166-1 alpha-2 code)
- System suggests currency based on country (50+ country mappings)
- User can override the suggested currency
- No IP geolocation or third-party services required

Example country-to-currency mapping:
- US → USD
- DE → EUR
- GB → GBP
- JP → JPY
- AU → AUD
- CA → CAD

### Health Monitoring
```bash
GET /currency/health
```

Response:
```json
{
  "status": "healthy",
  "lastUpdate": "2025-03-12T00:00:00.000Z",
  "cachedCurrencies": 50,
  "source": "Stripe Exchange Rates API"
}
```
