# RTK Query Refactor Plan

## Current Problem
- Single 600+ line file with all endpoints
- No separation of concerns
- Hard to maintain and test
- Monolithic structure

## Solution
Split into domain-specific API slices using RTK Query's `injectEndpoints` pattern.

## New Structure

```
frontend/store/api/
├── baseApi.ts          # Base API configuration
├── authApi.ts          # Authentication endpoints
├── paymentMethodsApi.ts # Payment methods
├── paymentsApi.ts      # Payments & refunds
├── usageApi.ts         # Usage & billing
├── subscriptionsApi.ts # Subscriptions
├── adminApi.ts         # Admin endpoints
├── currencyApi.ts      # Currency & exchange rates
├── disputesApi.ts      # Disputes
├── connectApi.ts       # Stripe Connect
└── index.ts            # Re-exports
```

## Benefits
- ✅ Separation of concerns
- ✅ Tree-shakeable exports
- ✅ Better caching per domain
- ✅ Easier testing
- ✅ Team scalability

---

## Task 1: Create Base API

**File:** `frontend/store/api/baseApi.ts`

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    credentials: 'include',
  }),
  tagTypes: [
    'User', 
    'PaymentMethods', 
    'Payments', 
    'Usage', 
    'BillingPreview', 
    'AdminDashboard', 
    'Subscriptions',
    'Disputes',
    'Connect',
  ],
  endpoints: () => ({}),
});
```

---

## Task 2: Create Auth API Slice

**File:** `frontend/store/api/authApi.ts`

```typescript
import { baseApi } from './baseApi';
import type { User, AuthResponse } from '@/types';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    // ... other auth endpoints
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetMeQuery,
} = authApi;
```

---

## Task 3: Create Payment Methods API

**File:** `frontend/store/api/paymentMethodsApi.ts`

---

## Task 4: Create Payments API

**File:** `frontend/store/api/paymentsApi.ts`

---

## Task 5: Create Usage API

**File:** `frontend/store/api/usageApi.ts`

---

## Task 6: Create Subscriptions API

**File:** `frontend/store/api/subscriptionsApi.ts`

---

## Task 7: Create Admin API

**File:** `frontend/store/api/adminApi.ts`

---

## Task 8: Create Currency API

**File:** `frontend/store/api/currencyApi.ts`

---

## Task 9: Create Disputes API

**File:** `frontend/store/api/disputesApi.ts`

---

## Task 10: Create Connect API

**File:** `frontend/store/api/connectApi.ts`

---

## Task 11: Create Index Export

**File:** `frontend/store/api/index.ts`

```typescript
export { baseApi } from './baseApi';
export * from './authApi';
export * from './paymentMethodsApi';
export * from './paymentsApi';
export * from './usageApi';
export * from './subscriptionsApi';
export * from './adminApi';
export * from './currencyApi';
export * from './disputesApi';
export * from './connectApi';
```

---

## Task 12: Update Store Configuration

**File:** `frontend/store/index.ts`

Update to use the new baseApi.

---

## Task 13: Update Imports Throughout App

Find/replace all imports from `@/store/api` to use new structure.

---

## Task 14: Build and Verify

```bash
cd frontend && npm run typecheck
```
