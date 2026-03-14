import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Base API Configuration
 * 
 * This is the foundation for all API slices.
 * Domain-specific APIs use injectEndpoints to extend this.
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
  endpoints: () => ({}),
});
