# Roadmap: Stripe Platform Improvements

**Created:** 2026-03-16
**Phases:** 4
**Requirements:** 32 v1 requirements mapped

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Foundation | Testing infrastructure + critical security | TEST-01-03, SEC-01-03, OBS-01-02 | 5 |
| 2 | Core Services | Type safety + test coverage | TEST-04-06, TYPE-01-04, BUG-01 | 5 |
| 3 | Webhooks & Performance | Webhook tests + performance fixes | TEST-06, PERF-01-05, TYPE-05-08 | 5 |
| 4 | Polish | Documentation + frontend tests + advanced | DOC-01-03, FTEST-01-03 | 3 |

---

## Phase 1: Foundation

**Goal:** Establish testing infrastructure and fix critical security gaps

**Requirements:** TEST-01, TEST-02, TEST-03, SEC-01, SEC-02, SEC-03, OBS-01, OBS-02

**Success Criteria:**
1. Vitest runs and reports coverage
2. AuthService has 80%+ test coverage
3. Rate limiting blocks excessive requests
4. Health endpoints return 200/503 appropriately
5. No UUID v4 used for security tokens

**Plans:** 3 plans in 3 waves

**Wave Structure:**
| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 01-01 | Testing infrastructure (Vitest, factories, mocks) |
| 2 | 01-02 | AuthService tests + UUID to crypto.randomBytes |
| 3 | 01-03 | Rate limiting + Health endpoints |

**Plan Details:**

### 01-01: Testing Infrastructure [COMPLETED]
- **Requirements:** TEST-01, TEST-02
- **Files:** vitest.config.ts, test/setup.ts, test/factories/, test/mocks/
- **Objective:** Set up Vitest with coverage reporting and create test utilities
- **Completed:** 2026-03-16
- **Commits:** 8dc7e9c, f447306

### 01-02: AuthService Tests + Security Fix [COMPLETED]
- **Requirements:** TEST-03, SEC-03
- **Files:** auth.service.spec.ts, auth.service.ts
- **Objective:** Write AuthService tests (80%+ coverage) and replace UUID with crypto.randomBytes
- **Depends on:** 01-01
- **Completed:** 2026-03-16
- **Commits:** edccb61, a5d0c6e

### 01-03: Rate Limiting + Health Endpoints [COMPLETED]
- **Requirements:** SEC-01, SEC-02, OBS-01, OBS-02
- **Files:** common/guards/rate-limit.guard.ts, common/middleware/, health/
- **Objective:** Implement rate limiting (global + per-route) and health check endpoints
- **Depends on:** 01-01
- **Completed:** 2026-03-16
- **Commits:** c1edaba, d98bc92, fa71262, 7e9d1e1

---

## Phase 2: Core Services

**Goal:** Extend test coverage and fix type safety issues

**Requirements:** TEST-04, TEST-05, TEST-06, TYPE-01, TYPE-02, TYPE-03, TYPE-04, BUG-01

**Success Criteria:**
1. PaymentsService has 80%+ coverage
2. SubscriptionsService has 80%+ coverage
3. Stripe webhook types defined
4. No `any` types in core services
5. User suspension logic implemented

**Key Tasks:**
- Write PaymentsService tests
- Write SubscriptionsService tests
- Define Stripe webhook interfaces
- Replace `any` types in webhooks, payments, subscriptions
- Implement user suspension

---

## Phase 3: Webhooks & Performance

**Goal:** Complete test coverage and fix performance issues

**Requirements:** TEST-06, PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, TYPE-05, TYPE-06, TYPE-07, TYPE-08

**Success Criteria:**
1. WebhooksService has 80%+ coverage
2. N+1 query fixed in admin service
3. Database indexes added
4. All `any` types replaced
5. Tax calculation errors handled properly

**Key Tasks:**
- Write WebhooksService tests
- Fix admin service N+1 query
- Add Prisma indexes
- Replace remaining `any` types
- Fix tax calculation error handling

**Plans:** 3 plans in 3 waves

**Wave Structure:**
| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 03-01 | WebhooksService tests (TEST-06) |
| 2 | 03-02 | Performance fixes - N+1 query + indexes (PERF-01-04) |
| 3 | 03-03 | Type safety fixes (TYPE-05-08) |

**Plan Details:**

### 03-01: WebhooksService Tests [COMPLETED]
- **Requirements:** TEST-06
- **Files:** webhooks/webhooks.service.spec.ts
- **Objective:** Write comprehensive unit tests for WebhooksService achieving 80%+ coverage
- **Depends on:** None (can run parallel to Phase 2 completion)
- **Completed:** 2026-03-16
- **Commits:** fac0ef0

### 03-02: Performance Fixes [COMPLETED]
- **Requirements:** PERF-01, PERF-02, PERF-03, PERF-04, PERF-05
- **Files:** admin/admin.service.ts, prisma/schema.prisma, cache/
- **Objective:** Fix N+1 query in admin service, add database indexes, and implement Redis-based caching
- **Depends on:** 03-01
- **Completed:** 2026-03-16
- **Commits:** eb97394, d1ca0a2, 2fbff2e, a139f6e, e6b7cf6

### 03-03: Type Safety Fixes [PLANNED]
- **Requirements:** TYPE-05, TYPE-06, TYPE-07, TYPE-08
- **Files:** connect/connect.service.ts, promo-codes/promo-code.service.ts, disputes/dispute.service.ts, mail/mail.service.ts
- **Objective:** Replace remaining 'any' types in connect, promo-code, and dispute services; fix null assertions in mail service
- **Depends on:** 03-02

---

## Phase 4: Polish

**Goal:** Documentation and frontend testing

**Requirements:** DOC-01, DOC-02, DOC-03, FTEST-01, FTEST-02, FTEST-03

**Success Criteria:**
1. Swagger docs accessible at /api/docs
2. All endpoints documented
3. Frontend test framework set up
4. Critical UI components tested
5. E2E tests for payment flow

**Plans:** 3 plans in 2 waves

**Wave Structure:**
| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 04-01, 04-02 | Swagger documentation + Frontend testing infrastructure (parallel) |
| 2 | 04-03 | Component tests & E2E tests (depends on 04-02) |

**Plan Details:**

### 04-01: Swagger/OpenAPI Documentation [PLANNED]
- **Requirements:** DOC-01, DOC-02, DOC-03
- **Files:** backend/src/main.ts, backend/src/**/*.controller.ts
- **Objective:** Set up Swagger and document all API endpoints with request/response examples
- **Depends on:** None (parallel with 04-02)

### 04-02: Frontend Testing Infrastructure [PLANNED]
- **Requirements:** FTEST-01
- **Files:** frontend/vitest.config.ts, frontend/src/test/setup.ts, frontend/src/test/utils.tsx
- **Objective:** Set up Vitest + React Testing Library with test utilities
- **Depends on:** None (parallel with 04-01)

### 04-03: Component & E2E Tests [PLANNED]
- **Requirements:** FTEST-02, FTEST-03
- **Files:** frontend/src/components/**/*.test.tsx, frontend/e2e/*.spec.ts
- **Objective:** Write component tests for critical UI and E2E tests for payment/auth flows
- **Depends on:** 04-02

---

## Traceability Matrix

| Req ID | Phase | Status |
|--------|-------|--------|
| TEST-01 | 1 | Completed |
| TEST-02 | 1 | Completed |
| TEST-03 | 1 | Completed |
| SEC-01 | 1 | Completed |
| SEC-02 | 1 | Completed |
| SEC-03 | 1 | Completed |
| OBS-01 | 1 | Completed |
| OBS-02 | 1 | Completed |
| TEST-04 | 2 | Completed |
| TEST-05 | 2 | Completed |
| TEST-06 | 3 | Completed |
| TYPE-01 | 2 | Completed |
| TYPE-02 | 2 | Completed |
| TYPE-03 | 2 | Completed |
| TYPE-04 | 2 | Completed |
| TYPE-05 | 3 | Pending |
| TYPE-06 | 3 | Pending |
| TYPE-07 | 3 | Pending |
| TYPE-08 | 3 | Pending |
| PERF-01 | 3 | Completed |
| PERF-02 | 3 | Completed |
| PERF-03 | 3 | Completed |
| PERF-04 | 3 | Completed |
| PERF-05 | 3 | Completed |
| BUG-01 | 2 | Completed |
| DOC-01 | 4 | Pending |
| DOC-02 | 4 | Pending |
| DOC-03 | 4 | Pending |
| FTEST-01 | 4 | Pending |
| FTEST-02 | 4 | Pending |
| FTEST-03 | 4 | Pending |

---

## Dependencies

```
Phase 1 (Foundation)
  └── No dependencies

Phase 2 (Core Services)
  └── Requires: Phase 1 (testing infrastructure)

Phase 3 (Webhooks & Performance)
  └── Requires: Phase 2 (type definitions)

Phase 4 (Polish)
  └── Requires: Phase 3 (stable API)
```

---

*Roadmap created: 2026-03-16*