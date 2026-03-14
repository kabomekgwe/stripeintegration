import { baseApi } from './baseApi';
import type { UsageRecord, BillingPreview, BillingResult, MonthlyBillingResult, CreateUsageRequest } from '@/types';

/**
 * Usage API
 *
 * Endpoints for usage tracking and billing.
 *
 * Cache Strategy:
 * - getUsage: 1 minute (usage updates frequently)
 * - getBillingPreview: 30 seconds (preview should be fresh)
 * - Mutations: no cache (actions)
 */
export const usageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsage: builder.query<{ usage: UsageRecord[] }, void>({
      query: () => '/usage',
      providesTags: ['Usage'],
      keepUnusedDataFor: 60, // Cache for 1 minute
    }),

    getBillingPreview: builder.query<{ preview: BillingPreview | null }, void>({
      query: () => '/usage/preview',
      providesTags: ['BillingPreview'],
      keepUnusedDataFor: 30, // Cache for 30 seconds (preview should be fresh)
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
