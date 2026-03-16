# Codebase Structure

**Analysis Date:** 2026-03-16

## Directory Layout

```
[project-root]/
├── frontend/                 # Next.js 15 frontend application
│   ├── app/               # Next.js App Router pages
│   │   ├── api/          # API proxy routes
│   │   ├── auth/         # Authentication pages
│   │   ├── dashboard/    # Dashboard pages
│   │   ├── payments/     # Payment flows
│   │   ├── subscriptions/# Subscription management
│   │   ├── disputes/     # Dispute handling
│   │   ├── usage/        # Usage tracking
│   │   ├── admin/        # Admin panel
│   │   ├── settings/     # User settings
│   │   ├── connect/      # Stripe Connect
│   │   ├── payment-methods/ # Payment method management
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Landing page
│   │   └── globals.css   # Global styles
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── stripe/      # Stripe-specific components
│   │   ├── providers/     # Context providers
│   │   ├── Navbar.tsx
│   │   ├── theme-provider.tsx
│   │   └── StoreProvider.tsx
│   ├── store/           # Redux + RTK Query
│   │   ├── api/         # API slices
│   │   ├── authSlice.ts
│   │   ├── index.ts
│   │   ├── persistConfig.ts
│   │   └── persistenceMiddleware.ts
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities
│   │   ├── api-client.ts
│   │   ├── auth.ts
│   │   ├── stripe-client.ts
│   │   └── utils.ts
│   ├── types/           # TypeScript types
│   ├── public/          # Static assets
│   └── package.json
├── backend/              # NestJS backend API
│   ├── src/
│   │   ├── auth/         # Authentication module
│   │   ├── users/        # User management
│   │   ├── payments/     # Payment processing
│   │   ├── payment-methods/ # Payment methods
│   │   ├── subscriptions/# Subscriptions
│   │   ├── usage/        # Usage tracking
│   │   ├── usage-subscriptions/ # Usage-based billing
│   │   ├── invoices/     # Invoice generation
│   │   ├── tax/          # Tax calculation
│   │   ├── disputes/     # Dispute handling
│   │   ├── connect/      # Stripe Connect
│   │   ├── promo-codes/  # Promotion codes
│   │   ├── currency/     # Currency conversion
│   │   ├── customer-portal/ # Customer portal
│   │   ├── admin/        # Admin operations
│   │   ├── webhooks/     # Stripe webhooks
│   │   ├── mail/         # Email service
│   │   ├── stripe/       # Stripe client
│   │   ├── database/     # Prisma/DB config
│   │   ├── redis/        # Redis client
│   │   ├── common/       # Shared utilities
│   │   ├── app.module.ts
│   │   ├── app.controller.ts
│   │   └── main.ts
│   ├── prisma/          # Prisma schema
│   ├── test/            # Test files
│   └── package.json
├── docs/                 # Documentation
├── docker-compose.yml   # Docker services
└── README.md
```

## Directory Purposes

**frontend/app/:**
- Purpose: Next.js App Router file-based routing
- Contains: Page components, layouts, API routes, loading states
- Key files: `layout.tsx`, `page.tsx`, `api/[...path]/route.ts`

**frontend/components/:**
- Purpose: Reusable React components
- Contains: UI components, layout components, Stripe components
- Pattern: shadcn/ui components in `ui/`, domain components in subdirectories

**frontend/store/:**
- Purpose: Redux state management and RTK Query API definitions
- Contains: Slices, API endpoints, persistence configuration
- Key files: `index.ts` (store config), `api/*.ts` (domain APIs)

**frontend/lib/:**
- Purpose: Utility functions and clients
- Contains: API client, auth helpers, Stripe client, utilities
- Key files: `api-client.ts`, `utils.ts`

**backend/src/*/:**
- Purpose: Domain modules following NestJS structure
- Each module contains: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `guards/`
- Examples: `payments/`, `auth/`, `subscriptions/`

**backend/src/common/:**
- Purpose: Shared utilities, guards, decorators
- Contains: Cross-cutting concerns used by multiple modules

**backend/src/database/:**
- Purpose: Database configuration and Prisma client
- Contains: Database module, Prisma service

**backend/src/redis/:**
- Purpose: Redis configuration and caching
- Contains: Redis module, cache service

## Key File Locations

**Entry Points:**
- `frontend/app/layout.tsx`: Root layout with providers
- `frontend/app/page.tsx`: Landing page
- `backend/src/main.ts`: NestJS bootstrap
- `backend/src/app.module.ts`: Root module

**Configuration:**
- `frontend/next.config.mjs`: Next.js configuration
- `frontend/tsconfig.json`: TypeScript config
- `backend/nest-cli.json`: NestJS CLI config
- `backend/tsconfig.json`: TypeScript config
- `docker-compose.yml`: Infrastructure services

**Core Logic:**
- `frontend/store/api/*.ts`: API slice definitions
- `frontend/lib/api-client.ts`: Server-side API client
- `backend/src/*/services/*.ts`: Business logic
- `backend/src/*/controllers/*.ts`: HTTP handlers

**State Management:**
- `frontend/store/index.ts`: Redux store configuration
- `frontend/store/authSlice.ts`: Auth state
- `frontend/store/api/baseApi.ts`: RTK Query base

**Testing:**
- `backend/test/`: E2E tests
- `backend/src/*.spec.ts`: Unit tests (co-located)

## Naming Conventions

**Files:**
- Components: `PascalCase.tsx` (e.g., `Navbar.tsx`)
- Utilities: `camelCase.ts` (e.g., `api-client.ts`)
- Styles: `kebab-case.css` (e.g., `globals.css`)
- Tests: `*.spec.ts` (NestJS), `*.test.ts` (implied)

**Directories:**
- Feature-based: `kebab-case/` (e.g., `payment-methods/`)
- Domain modules: `camelCase/` (e.g., `subscriptions/`)

**NestJS Conventions:**
- Modules: `*.module.ts`
- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- DTOs: `*.dto.ts` or `dto/*.dto.ts`
- Guards: `*.guard.ts`

## Where to Add New Code

**New Feature (Frontend):**
- Page: `frontend/app/[feature]/page.tsx`
- Components: `frontend/components/[feature]/`
- API: `frontend/store/api/[feature]Api.ts`
- Types: `frontend/types/[feature].ts`

**New Feature (Backend):**
- Module: `backend/src/[feature]/[feature].module.ts`
- Controller: `backend/src/[feature]/[feature].controller.ts`
- Service: `backend/src/[feature]/[feature].service.ts`
- DTOs: `backend/src/[feature]/dto/*.dto.ts`

**New API Endpoint:**
- Frontend slice: `frontend/store/api/[domain]Api.ts` (injectEndpoints)
- Backend controller: Add method to existing controller
- Backend service: Add business logic method

**New Component:**
- UI primitive: `frontend/components/ui/*.tsx` (shadcn)
- Domain component: `frontend/components/[domain]/*.tsx`
- Page section: Co-located in `frontend/app/[page]/`

**Utilities:**
- Shared helpers: `frontend/lib/utils.ts`
- Domain-specific: `frontend/lib/[domain].ts`

## Special Directories

**.next/:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**dist/ (backend):**
- Purpose: Compiled JavaScript output
- Generated: Yes
- Committed: No

**node_modules/:**
- Purpose: Dependencies
- Generated: Yes
- Committed: No

**prisma/:**
- Purpose: Prisma schema and migrations
- Contains: `schema.prisma`, migration files
- Generated: Migrations generated, schema manual
- Committed: Yes

---

*Structure analysis: 2026-03-16*
