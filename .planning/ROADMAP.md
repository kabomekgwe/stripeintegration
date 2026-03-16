# Roadmap: Stripe Platform Improvements

**Created:** 2026-03-16
**Phases:** 4
**Requirements:** 32 v1 requirements mapped

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Foundation | Testing infrastructure + critical security | TEST-01-03, SEC-01-03, OBS-01-02 | 5 |
| 2 | 1/3 | In Progress|  | 5 |
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

**Key Tasks:**
- Set up Swagger/OpenAPI
- Document all endpoints
- Set up React Testing Library
- Write component tests
- Add Playwright E2E tests

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
| TEST-04 | 2 | Pending |
| TEST-05 | 2 | Pending |
| TEST-06 | 3 | Pending |
| TYPE-01 | 2 | Pending |
| TYPE-02 | 2 | Pending |
| TYPE-03 | 2 | Pending |
| TYPE-04 | 2 | Pending |
| TYPE-05 | 3 | Pending |
| TYPE-06 | 3 | Pending |
| TYPE-07 | 3 | Pending |
| TYPE-08 | 3 | Pending |
| PERF-01 | 3 | Pending |
| PERF-02 | 3 | Pending |
| PERF-03 | 3 | Pending |
| PERF-04 | 3 | Pending |
| PERF-05 | 3 | Pending |
| BUG-01 | 2 | Pending |
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
