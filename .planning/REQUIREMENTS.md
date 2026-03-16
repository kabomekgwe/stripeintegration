# Requirements: Stripe Platform Improvements

**Defined:** 2026-03-16
**Core Value:** Transform codebase from "works in development" to "production-ready"

## v1 Requirements (Critical + High Priority)

### Testing Infrastructure (CRIT-01)

- [ ] **TEST-01**: Set up Vitest testing framework in backend
- [ ] **TEST-02**: Create test utilities (factories, mocks, fixtures)
- [ ] **TEST-03**: Write unit tests for AuthService (80%+ coverage)
- [x] **TEST-04**: Write unit tests for PaymentsService (80%+ coverage)
- [x] **TEST-05**: Write unit tests for SubscriptionsService (80%+ coverage)
- [ ] **TEST-06**: Write unit tests for WebhooksService (80%+ coverage)
- [ ] **TEST-07**: Set up test coverage reporting in CI
- [ ] **TEST-08**: Add integration tests for critical API flows

### Security Hardening (CRIT-02, HIGH-01)

- [ ] **SEC-01**: Implement global rate limiting middleware
- [ ] **SEC-02**: Add per-route rate limiting (auth: 5/min, payments: 10/min)
- [ ] **SEC-03**: Replace UUID v4 with crypto.randomBytes for reset tokens
- [ ] **SEC-04**: Add request validation middleware (Zod)
- [ ] **SEC-05**: Implement proper CORS configuration
- [ ] **SEC-06**: Add security headers (HSTS, CSP, X-Frame-Options)

### Observability (CRIT-03, HIGH-02)

- [ ] **OBS-01**: Create /health endpoint (liveness check)
- [ ] **OBS-02**: Create /health/ready endpoint (readiness with DB/Redis checks)
- [ ] **OBS-03**: Replace console.log with structured logging (Pino/Winston)
- [ ] **OBS-04**: Add request logging middleware
- [ ] **OBS-05**: Add error tracking integration

### Type Safety (HIGH-01)

- [x] **TYPE-01**: Define interfaces for Stripe webhook events
- [x] **TYPE-02**: Replace `any` in webhooks.service.ts
- [x] **TYPE-03**: Replace `any` in payments.service.ts
- [x] **TYPE-04**: Replace `any` in subscriptions.service.ts
- [ ] **TYPE-05**: Replace `any` in connect.service.ts
- [ ] **TYPE-06**: Replace `any` in promo-code.service.ts
- [ ] **TYPE-07**: Replace `any` in disputes.service.ts
- [ ] **TYPE-08**: Fix mail.service.ts null assertion

### Performance (HIGH-03, MED-01)

- [ ] **PERF-01**: Fix N+1 query in admin.service.ts
- [ ] **PERF-02**: Add database indexes for user lookups
- [ ] **PERF-03**: Add database indexes for payment queries
- [ ] **PERF-04**: Add database indexes for subscription queries
- [ ] **PERF-05**: Implement query result caching for frequently accessed data

### Bug Fixes (HIGH-04, MED-02)

- [x] **BUG-01**: Implement user suspension logic (currently stubbed)
- [ ] **BUG-02**: Fix tax calculation silent failure
- [ ] **BUG-03**: Fix currency exchange error handling
- [ ] **BUG-04**: Standardize error handling (Result pattern)

## v2 Requirements (Medium Priority)

### API Documentation

- **DOC-01**: Set up Swagger/OpenAPI documentation
- **DOC-02**: Document all API endpoints
- **DOC-03**: Add request/response examples

### Frontend Testing

- **FTEST-01**: Set up React Testing Library
- **FTEST-02**: Write component tests for critical UI
- **FTEST-03**: Add E2E tests with Playwright

### Advanced Features

- **ADV-01**: Implement webhook retry logic with exponential backoff
- **ADV-02**: Add request idempotency keys
- **ADV-03**: Implement circuit breaker for external APIs

## Out of Scope

| Feature | Reason |
|---------|--------|
| UI redesign | Focus on backend stability |
| New features (reporting) | Fix existing first |
| Mobile app | Out of scope |
| Migration to different stack | Improve current stack |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 1 | Pending |
| TEST-04 | Phase 2 | Complete |
| TEST-05 | Phase 2 | Complete |
| TEST-06 | Phase 3 | Pending |
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| OBS-01 | Phase 1 | Pending |
| OBS-02 | Phase 1 | Pending |
| TYPE-01 | Phase 2 | Complete |
| TYPE-02 | Phase 2 | Complete |
| PERF-01 | Phase 3 | Pending |
| BUG-01 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
