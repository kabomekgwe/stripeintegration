import { createApi, fetchBaseQuery, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { clearCredentials } from '@/store/authSlice';
import { clearAllCache } from '@/store/persistenceMiddleware';

/**
 * Base API Configuration
 * 
 * This is the foundation for all API slices.
 * Domain-specific APIs use injectEndpoints to extend this.
 * 
 * Caching Strategy:
 * - Data persists until explicitly invalidated via tags
 * - No automatic expiration (keepUnusedDataFor: Infinity)
 * - Cache is cleared on logout or manual invalidation
 * - refetchOnMountOrArgChange: false (use cache if available)
 * - refetchOnFocus: false (don't refetch on focus)
 * - refetchOnReconnect: true (refetch when network reconnects)
 */

const baseQuery = fetchBaseQuery({
  baseUrl: '/api',
  credentials: 'include',
});

const baseQueryWithAuthError: BaseQueryFn = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    api.dispatch(clearCredentials());
    clearAllCache();

    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login?reason=session_expired';
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuthError,
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
    'PromoCodes',
  ],
  keepUnusedDataFor: 60,
  refetchOnMountOrArgChange: false,
  refetchOnFocus: false,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});
