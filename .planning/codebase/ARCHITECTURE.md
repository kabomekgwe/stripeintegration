# Architecture

**Analysis Date:** 2026-03-16

## Pattern Overview

**Overall:** Modular Monolith with Clean Architecture principles

**Key Characteristics:**
- Backend follows NestJS modular architecture with domain-driven modules
- Frontend uses Next.js 15 with App Router and React Server Components
- State management via Redux Toolkit with RTK Query for API caching
- API communication through proxy pattern (Next.js API routes proxy to backend)
- Authentication via JWT with cookie-based session management

## Layers

**Presentation Layer (Frontend):**
- Purpose: UI rendering, user interactions, client-side state
- Location: `frontend/app/`, `frontend/components/`
- Contains: React components, pages, hooks, client-side providers
- Depends on: Redux store, API client, backend via proxy
- Used by: Browser/client

**API Proxy Layer:**
- Purpose: Forward requests from frontend to backend with auth forwarding
- Location: `frontend/app/api/[...path]/route.ts`
- Contains: Catch-all API route handler, cookie forwarding, API key injection
- Depends on: Backend service
- Used by: Frontend components (via RTK Query)

**State Management Layer:**
- Purpose: Global state and server state caching
- Location: `frontend/store/`
- Contains: Redux slices, RTK Query API definitions, persistence middleware
- Depends on: Backend API, localStorage/sessionStorage
- Used by: React components via hooks

**Transport Layer (Backend):**
- Purpose: HTTP request handling, validation, routing
- Location: `backend/src/*/controllers/`
- Contains: NestJS controllers, DTOs, guards, decorators
- Depends on: Service layer
- Used by: Frontend via API proxy

**Business Logic Layer:**
- Purpose: Core business rules, orchestration, Stripe integration
- Location: `backend/src/*/services/`
- Contains: Services, Stripe API integration, business workflows
- Depends on: Repository layer, external APIs (Stripe)
- Used by: Controllers

**Data Access Layer:**
- Purpose: Database operations, caching
- Location: `backend/src/database/`, `backend/src/redis/`
- Contains: Prisma client, repositories, Redis client
- Depends on: PostgreSQL, Redis
- Used by: Services

## Data Flow

**Payment Creation Flow:**

1. User submits payment form (React Client Component)
2. Form submission triggers RTK Query mutation (`paymentsApi.createPaymentIntent`)
3. RTK Query sends request to `/api/payments/intent` (Next.js API proxy)
4. Proxy forwards to backend `POST /payments/intent` with cookies
5. `PaymentsController` receives request, validates JWT, applies rate limit guard
6. `PaymentsService` processes business logic, calls Stripe API
7. Result stored in database via Prisma, returned to client
8. RTK Query caches response, updates Redux store
9. UI updates with payment status

**Authentication Flow:**

1. User submits login form
2. `authApi.login` mutation sends credentials to `/api/auth/login`
3. Backend `AuthController` validates credentials via `AuthService`
4. JWT token generated, set as HTTP-only cookie
5. Frontend receives success, updates `authSlice` state
6. RTK Query persistence middleware stores auth state
7. Subsequent requests automatically include cookie via proxy

**State Management:**

- Server state (API data): RTK Query with tag-based invalidation
- Client state (UI): Redux slices (auth, theme)
- Persistence: Custom middleware persists RTK Query cache to localStorage/sessionStorage
- Cache strategy: `keepUnusedDataFor: Infinity` - manual invalidation only

## Key Abstractions

**BaseApi (RTK Query):**
- Purpose: Foundation for all API slices with shared configuration
- Location: `frontend/store/api/baseApi.ts`
- Pattern: Endpoint injection pattern for domain-specific APIs
- Features: Cookie credentials, tag-based caching, persistence

**ApiClient (Server-Side):**
- Purpose: Server-side API calls from React Server Components
- Location: `frontend/lib/api-client.ts`
- Pattern: Async function with automatic cookie forwarding
- Used in: Server Components for initial data fetching

**NestJS Modules:**
- Purpose: Encapsulated domain modules with controllers, services, providers
- Location: `backend/src/*/*.module.ts`
- Pattern: Feature modules imported into AppModule
- Examples: `PaymentsModule`, `AuthModule`, `SubscriptionsModule`

**Guards:**
- Purpose: Cross-cutting concerns (auth, rate limiting)
- Location: `backend/src/*/guards/`, `backend/src/common/guards/`
- Pattern: NestJS guard classes with `@UseGuards()` decorator
- Examples: `JwtAuthGuard`, `PaymentRateLimitGuard`, `ApiKeyGuard`

**DTOs:**
- Purpose: Request/response validation and typing
- Location: `backend/src/*/dto/`
- Pattern: Class-validator decorators with class-transformer
- Examples: `CreatePaymentDto`, `CreateRefundDto`

## Entry Points

**Frontend Application:**
- Location: `frontend/app/layout.tsx`
- Type: Next.js Root Layout (Server Component)
- Triggers: All page requests
- Responsibilities: Theme provider, Redux store provider, font loading

**Backend Application:**
- Location: `backend/src/main.ts`
- Type: NestJS bootstrap
- Triggers: Server startup
- Responsibilities: CORS, cookie parser, module initialization

**API Proxy:**
- Location: `frontend/app/api/[...path]/route.ts`
- Type: Next.js API Route (catch-all)
- Triggers: All `/api/*` requests from frontend
- Responsibilities: Forward to backend, cookie handling, error transformation

**Webhooks:**
- Location: `backend/src/webhooks/`
- Type: Stripe webhook handlers
- Triggers: External Stripe events
- Responsibilities: Event verification, async processing

## Error Handling

**Strategy:** Layer-specific error handling with consistent response format

**Patterns:**
- Backend: NestJS exception filters, HTTP exceptions with status codes
- Frontend: RTK Query error handling, Redux error states
- API Proxy: Try-catch with JSON error responses

**Error Response Format:**
```json
{
  "error": "Error message",
  "status": 500
}
```

## Cross-Cutting Concerns

**Logging:** Console logging in development, structured logging via NestJS in production

**Validation:**
- Backend: class-validator DTOs with ValidationPipe
- Frontend: Zod schemas (implied by dependencies)

**Authentication:**
- JWT tokens in HTTP-only cookies
- Global `ApiKeyGuard` for API routes
- `JwtAuthGuard` for protected endpoints
- Passport JWT strategy

**Rate Limiting:**
- Custom `PaymentRateLimitGuard` for payment endpoints
- Bull queue for webhook processing

**Caching:**
- RTK Query with tag-based invalidation (frontend)
- Redis for session/cache (backend)

---

*Architecture analysis: 2026-03-16*
