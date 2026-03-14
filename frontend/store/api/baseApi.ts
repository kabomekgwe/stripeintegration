import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Base API Configuration
 * 
 * This is the foundation for all API slices.
 * Domain-specific APIs use injectEndpoints to extend this.
 * 
 * Caching Strategy:
 * - keepUnusedDataFor: 60 seconds (default cache duration)
 * - refetchOnMountOrArgChange: true (refetch when component mounts with same args)
 * - refetchOnFocus: true (refetch when window regains focus)
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
  keepUnusedDataFor: 60, // Keep cached data for 60 seconds after last subscriber unsubscribes
  refetchOnMountOrArgChange: true, // Refetch when component mounts with same args
  refetchOnFocus: true, // Refetch when window regains focus
  refetchOnReconnect: true, // Refetch when network reconnects
  endpoints: () => ({}),
});
