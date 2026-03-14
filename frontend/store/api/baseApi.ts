import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

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
    'PromoCodes',
  ],
  keepUnusedDataFor: Infinity, // Data persists until explicitly invalidated
  refetchOnMountOrArgChange: false, // Use cache if available
  refetchOnFocus: false, // Don't refetch on window focus
  refetchOnReconnect: true, // Refetch when network reconnects
  endpoints: () => ({}),
});
