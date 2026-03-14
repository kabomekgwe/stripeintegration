import { baseApi } from './baseApi';
import type { UsageRecord, BillingPreview, BillingResult, MonthlyBillingResult, CreateUsageRequest } from '@/types';

/**
 * Usage API
 *
 * Endpoints for usage tracking and billing.
 *
 * Cache Strategy:
 * - getUsage: Persist until 'Usage' tag invalidated
 * - getBillingPreview: Persist until 'BillingPreview' tag invalidated
 * - Mutations: Invalidate related tags
 */
export const usageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsage: builder.query<{ usage: UsageRecord[] }, void>({
      query: () => '/usage',
      providesTags: ['Usage'],
      // Data persists until 'Usage' tag is invalidated
    }),

    getBillingPreview: builder.query<{ preview: BillingPreview | null }, void>({
      query: () => '/usage/preview',
      providesTags: ['BillingPreview'],
      // Data persists until 'BillingPreview' tag is invalidated
    }),

    recordUsage: builder.mutation<{ usage: UsageRecord }, CreateUsageRequest>({
      query: (data) => ({
        url: '/usage',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Usage', 'BillingPreview'],
    }),

    generateBilling: builder.mutation<BillingResult, void>({
      query: () => ({
        url: '/usage/billing/generate',
        method: 'POST',
      }),
      invalidatesTags: ['Usage', 'Payments', 'BillingPreview'],
    }),

    runMonthlyBilling: builder.mutation<MonthlyBillingResult, void>({
      query: () => ({
        url: '/admin/billing/run-monthly',
        method: 'POST',
      }),
      invalidatesTags: ['Usage', 'Payments', 'BillingPreview'],
    }),
  }),
});

export const {
  useGetUsageQuery,
  useRecordUsageMutation,
  useGetBillingPreviewQuery,
  useGenerateBillingMutation,
  useRunMonthlyBillingMutation,
} = usageApi;
