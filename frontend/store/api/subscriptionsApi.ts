import { baseApi } from './baseApi';

/**
 * Subscriptions API
 *
 * Endpoints for subscription management.
 */
export const subscriptionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSubscriptionPlans: builder.query<{ plans: any[] }, void>({
      query: () => '/subscriptions/plans',
      providesTags: ['Subscriptions'],
    }),

    getSubscription: builder.query<{
      current: any | null;
      all: any[];
    }, void>({
      query: () => '/subscriptions',
      providesTags: ['Subscriptions'],
    }),

    createSubscription: builder.mutation<
      { clientSecret: string; subscriptionId: string },
      { priceId: string; paymentMethodId?: string }
    >({
      query: (data) => ({
        url: '/subscriptions',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Subscriptions'],
    }),

    updateSubscription: builder.mutation<
      { message: string },
      { id: string; priceId?: string; cancelAtPeriodEnd?: boolean }
    >({
      query: ({ id, ...data }) => ({
        url: `/subscriptions/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Subscriptions'],
    }),

    cancelSubscription: builder.mutation<
      { message: string },
      { id: string; cancelMode?: 'immediately' | 'period_end' }
    >({
      query: ({ id, ...data }) => ({
        url: `/subscriptions/${id}`,
        method: 'DELETE',
        body: data,
      }),
      invalidatesTags: ['Subscriptions'],
    }),

    // Customer Portal
    createPortalSession: builder.mutation<{ url: string }, void>({
      query: () => ({
        url: '/customer-portal/session',
        method: 'POST',
      }),
    }),

    // Usage-Based Subscriptions (Metered Billing)
    createUsageSubscription: builder.mutation<{
      subscriptionId: string;
      clientSecret?: string;
    }, { priceId: string; paymentMethodId?: string }>({
      query: (data) => ({
        url: '/usage-subscriptions',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Subscriptions'],
    }),

    recordMeteredUsage: builder.mutation<void, {
      subscriptionId: string;
      quantity: number;
      timestamp?: Date;
    }>({
      query: ({ subscriptionId, ...data }) => ({
        url: `/usage-subscriptions/${subscriptionId}/usage`,
        method: 'POST',
        body: data,
      }),
    }),

    getUsageSummary: builder.query<{
      totalUsage: number;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
    }, string>({
      query: (subscriptionId) =>
        `/usage-subscriptions/${subscriptionId}/usage-summary`,
    }),
  }),
});

export const {
  useGetSubscriptionPlansQuery,
  useGetSubscriptionQuery,
  useCreateSubscriptionMutation,
  useUpdateSubscriptionMutation,
  useCancelSubscriptionMutation,
  useCreatePortalSessionMutation,
  useCreateUsageSubscriptionMutation,
  useRecordMeteredUsageMutation,
  useGetUsageSummaryQuery,
} = subscriptionsApi;
