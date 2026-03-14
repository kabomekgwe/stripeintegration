# RTK Query Caching Strategy

## Overview

This project implements a **tag-based caching strategy** for RTK Query with persistence to localStorage and sessionStorage:

1. **Memory Cache** (RTK Query default) - Fast, per-session
2. **Session Storage** - Survives page refresh, cleared on tab close
3. **Local Storage** - Survives browser restart, long-term persistence

## Key Principle: Cache by Tags, Not Time

**Data persists until explicitly invalidated via cache tags.**

- No automatic expiration based on time
- Mutations automatically invalidate related tags
- Manual invalidation available when needed
- All cache cleared on logout

## Cache Layers

### Layer 1: Memory Cache (Default)

- **Invalidation**: Via cache tags
- **Scope**: Current tab only
- **Use for**: All data (with tag-based invalidation)

```typescript
// Data persists until 'User' tag is invalidated
getMe: builder.query({
  query: () => '/auth/me',
  providesTags: ['User'],
});

// Mutation invalidates 'User' tag
updateProfile: builder.mutation({
  query: (data) => ({ url: '/auth/profile', method: 'PATCH', body: data }),
  invalidatesTags: ['User'],
});
```

### Layer 2: Session Storage

- **Invalidation**: Via cache tags or tab close
- **Scope**: Current tab, survives refresh
- **Use for**: User data that should persist during session

**Endpoints using sessionStorage:**
- `getPayments` - Payment history
- `getUsage` - Usage records
- `getAdminDashboard` - Admin data
- `getDisputes` - Dispute data

### Layer 3: Local Storage

- **Invalidation**: Via cache tags or manual clearing
- **Scope**: Survives browser restart
- **Use for**: Static/reference data, user preferences

**Endpoints using localStorage:**
- `getMe` - User profile
- `getCurrencies` - Currency list
- `getPaymentMethods` - Saved payment methods
- `getSubscriptionPlans` - Subscription plans

## Configuration

### Adding Persistence to an Endpoint

1. Add entry to `store/persistConfig.ts`:

```typescript
export const PERSIST_CONFIG: Record<string, PersistConfig> = {
  'getMyData': {
    endpoint: 'getMyData',
    storage: 'local', // or 'session' or 'memory'
  },
};
```

2. Add cache tags to the endpoint:

```typescript
getMyData: builder.query({
  query: () => '/my-data',
  providesTags: ['MyData'],
});
```

3. The middleware automatically handles persistence - no changes needed to components!

## Cache Invalidation

### Automatic Invalidation (Recommended)

RTK Query automatically invalidates cache when mutations occur:

```typescript
// When payment method is saved...
savePaymentMethod: builder.mutation({
  query: (data) => ({ url: '/payment-methods', method: 'POST', body: data }),
  invalidatesTags: ['PaymentMethods', 'User'],
});

// This automatically refetches:
// - getPaymentMethods (has 'PaymentMethods' tag)
// - getMe (has 'User' tag)
```

### Manual Invalidation

```typescript
import { baseApi } from '@/store/api';
import { useDispatch } from 'react-redux';

const dispatch = useDispatch();

// Invalidate specific tags
dispatch(baseApi.util.invalidateTags(['User', 'Payments']));

// Invalidate all cache
dispatch(baseApi.util.resetApiState());
```

### Component-Level Refetch

```typescript
const { refetch } = useGetPaymentsQuery();

// Refetch on demand
<button onClick={() => refetch()}>Refresh</button>
```

## Cache Clearing

### Automatic Clearing

- **On Logout**: All cache is cleared
- **On Mutation**: Related cache is invalidated
- **On Tab Close**: Session storage cleared

### Manual Clearing

```typescript
import { clearAllCache } from '@/store/persistenceMiddleware';

// Clear all persisted cache
clearAllCache();
```

## Cache Status Component

Use the `CacheStatusPanel` component to view cache status:

```tsx
import { CacheStatusPanel } from '@/components/CacheStatusPanel';

export function AdminPage() {
  return (
    <div>
      <CacheStatusPanel />
    </div>
  );
}
```

## Performance Benefits

| Scenario | Without Cache | With Cache |
|----------|--------------|------------|
| Page refresh | 5-10 requests | 0-2 requests |
| Revisit app | Full reload | Instant load |
| Tab switch | Re-fetch | Instant display |
| Network offline | Error | Cached data |
| Mutation | Manual refresh | Auto-refetch |

## Best Practices

### ✅ Do

- Use `providesTags` on all queries
- Use `invalidatesTags` on all mutations
- Use `localStorage` for static/reference data
- Use `sessionStorage` for user session data
- Invalidate cache on mutations
- Handle cache clearing on logout

### ❌ Don't

- Store sensitive data (passwords, tokens) in storage
- Forget to add `providesTags` to queries
- Forget to add `invalidatesTags` to mutations
- Ignore cache size limits (5MB for localStorage)
- Use time-based expiration (use tags instead)

## Troubleshooting

### Cache Not Persisting

1. Check browser storage quotas
2. Verify endpoint is in `PERSIST_CONFIG`
3. Check for private/incognito mode

### Stale Data

1. Verify `providesTags` is set on query
2. Verify `invalidatesTags` is set on mutation
3. Check that tags match between query and mutation
4. Use manual invalidation if needed

### Storage Quota Exceeded

1. Use memory-only for large data
2. Clear cache manually
3. Use pagination for large lists

## Implementation Details

### Files

- `store/persistConfig.ts` - Persistence configuration
- `store/persistenceMiddleware.ts` - Middleware implementation
- `store/index.ts` - Store setup with middleware
- `hooks/useCacheStatus.ts` - Cache status hook
- `components/CacheStatusPanel.tsx` - Debug component

### Middleware Flow

```
1. Request initiated
   ↓
2. RTK Query checks memory cache
   ↓
3. If miss, check localStorage/sessionStorage
   ↓
4. If miss, fetch from API
   ↓
5. Response received
   ↓
6. Middleware persists to storage (if configured)
   ↓
7. Next request uses cached data
   ↓
8. Mutation invalidates tags → cache cleared
```

## Migration Guide

### Adding Persistence to Existing Endpoint

1. Add `providesTags` to query:

```typescript
getMyData: builder.query({
  query: () => '/my-data',
  providesTags: ['MyData'], // Add this
});
```

2. Add `invalidatesTags` to mutations:

```typescript
updateMyData: builder.mutation({
  query: (data) => ({ url: '/my-data', method: 'PATCH', body: data }),
  invalidatesTags: ['MyData'], // Add this
});
```

3. Add to `PERSIST_CONFIG`:

```typescript
'getMyData': {
  endpoint: 'getMyData',
  storage: 'local',
}
```

4. Cache will persist and auto-invalidate on mutations

### Removing Persistence

1. Remove from `PERSIST_CONFIG`
2. Cache will stop persisting immediately
3. Existing cached data remains until cleared
