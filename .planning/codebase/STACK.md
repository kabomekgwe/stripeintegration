# Technology Stack

**Analysis Date:** 2026-03-16

## Languages

**Primary:**
- TypeScript 5.7+ (Backend), 5.9+ (Frontend) - All application code
- SQL - PostgreSQL database queries via Prisma

**Secondary:**
- CSS/Tailwind - Frontend styling
- HTML - Email templates (Handlebars)
- YAML - Docker Compose configuration
- TOML - Prisma configuration

## Runtime

**Environment:**
- Node.js 22+ (development), 20+ (Docker)
- Backend: Express.js via NestJS platform-express
- Frontend: Next.js 16.1.6 with Turbopack

**Package Manager:**
- npm (lockfile present in frontend)
- pnpm (implied by recent commits)

## Frameworks

**Core:**
- **Backend:** NestJS 11.0+ - Modular architecture with decorators
- **Frontend:** Next.js 16.1.6 - App Router with React Server Components
- **UI:** React 19.2.4 - Component library

**State Management:**
- Redux Toolkit 2.6.1 - Global state management
- React Redux 9.2.0 - React bindings
- RTK Query - API data fetching with caching

**Styling:**
- Tailwind CSS 4.1.18 - Utility-first CSS
- shadcn/ui 4.0.5 - Component primitives
- Radix UI - Headless UI components

**Testing:**
- Jest 30.0.0 - Unit testing (backend)
- ts-jest - TypeScript transformer
- Supertest - HTTP assertion library

**Build/Dev:**
- TypeScript Compiler - Type checking and compilation
- PostCSS 8 - CSS processing
- Prettier 3.8.1 - Code formatting
- ESLint 9.x - Linting

## Key Dependencies

**Critical:**
- `@prisma/client` 6.5.0 - Database ORM and query builder
- `stripe` 17.7.0 - Stripe SDK for payments
- `@stripe/react-stripe-js` 3.6.0 / `@stripe/stripe-js` 6.1.0 - Stripe React integration
- `bull` 4.16.5 / `@nestjs/bull` 11.0.4 - Job queue processing
- `ioredis` 5.5.0 - Redis client
- `passport` 0.7.0 / `@nestjs/passport` 11.0.5 - Authentication middleware
- `@nestjs/jwt` 11.0.0 - JWT handling
- `bcrypt` 5.1.1 - Password hashing
- `zod` 3.24.2 - Schema validation

**Infrastructure:**
- `@nestjs/config` 4.0.0 - Environment configuration
- `@nestjs/schedule` 5.0.1 - Cron jobs and scheduling
- `axios` 1.8.3 - HTTP client
- `nodemailer` 8.0.2 - Email sending
- `pdfkit` 0.17.2 - PDF generation
- `puppeteer` 24.39.0 - Browser automation
- `handlebars` 4.7.8 - Email templating
- `uuid` 11.1.0 - UUID generation

**Frontend UI:**
- `@base-ui/react` 1.3.0 - Base UI components
- `@phosphor-icons/react` 2.1.10 - Icon library
- `lucide-react` 0.577.0 - Additional icons
- `react-hook-form` 7.54.2 - Form management
- `class-variance-authority` 0.7.1 - Component variants
- `tailwind-merge` 3.5.0 - Tailwind class merging
- `next-themes` 0.4.6 - Theme management

## Configuration

**Environment:**
- `.env` - Local development secrets (gitignored)
- `.env.example` - Template with dummy values
- `docker-compose.yml` - Container orchestration with env vars

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `JWT_SECRET` - JWT signing secret
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email configuration
- `FRONTEND_URL`, `BACKEND_URL` - App URLs

**Build:**
- `tsconfig.json` - TypeScript configuration (strict mode)
- `next.config.mjs` - Next.js configuration (standalone output)
- `postcss.config.mjs` - PostCSS with Tailwind
- `eslint.config.mjs` - ESLint flat config
- `components.json` - shadcn/ui configuration

**Database:**
- `prisma/schema.prisma` - Database schema definition
- Prisma migrations in `prisma/migrations/`

## Platform Requirements

**Development:**
- Node.js 22+ recommended
- Docker & Docker Compose
- Stripe CLI (for webhook forwarding)
- PostgreSQL 16+ (via Docker)
- Redis 7+ (via Docker)

**Production:**
- Docker containers (Alpine Linux base)
- PostgreSQL 16 database
- Redis 7 cache/queue
- Stripe account (test or live mode)
- SMTP server for email delivery

**Deployment:**
- Docker Compose for full stack
- Standalone Next.js output
- NestJS compiled to `dist/`
- Health checks configured for all services

---

*Stack analysis: 2026-03-16*
