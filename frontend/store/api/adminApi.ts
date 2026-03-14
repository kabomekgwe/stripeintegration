import { baseApi } from './baseApi';

/**
 * Admin API
 *
 * Endpoints for admin dashboard, user management, and webhooks.
 */
export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Dashboard
    getAdminDashboard: builder.query<{
      metrics: any;
      recentTransactions: any[];
      paymentMethods: any[];
    }, void>({
      query: () => '/admin/dashboard',
      providesTags: ['AdminDashboard'],
    }),

    getAdminMetrics: builder.query<any, void>({
      query: () => '/admin/metrics',
      providesTags: ['AdminDashboard'],
    }),

    getAdminRevenue: builder.query<
      any,
      { period?: 'day' | 'week' | 'month'; days?: number }
    >({
      query: ({ period = 'day', days = 30 }) =>
        `/admin/revenue?period=${period}&days=${days}`,
      providesTags: ['AdminDashboard'],
    }),

    getAdminTransactions: builder.query<
      { transactions: any[] },
      { limit?: number }
    >({
      query: ({ limit = 20 }) => `/admin/transactions?limit=${limit}`,
    }),

    // User Management
    getAdminUsers: builder.query<
      { users: any[]; total: number },
      { page?: number; limit?: number; search?: string }
    >({
      query: ({ page = 1, limit = 20, search }) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (search) params.append('search', search);
        return `/admin/users?${params.toString()}`;
      },
    }),

    getAdminUserDetails: builder.query<any, string>({
      query: (userId) => `/admin/users/${userId}`,
    }),

    suspendUser: builder.mutation<
      { message: string; userId: string },
      string
    >({
      query: (userId) => ({
        url: `/admin/users/${userId}/suspend`,
        method: 'POST',
      }),
    }),

    // Webhooks
    getWebhookStats: builder.query<{
      total: number;
      processed: number;
      failed: number;
      pending: number;
      byType: Record<string, number>;
    }, void>({
      query: () => '/admin/webhooks/stats',
      providesTags: ['AdminDashboard'],
    }),

    getWebhookEvents: builder.query<{
      events: any[];
      total: number;
    }, {
      limit?: number;
      offset?: number;
      processed?: boolean;
      failed?: boolean;
      type?: string;
    }>({
      query: ({
        limit = 50,
        offset = 0,
        processed,
        failed,
        type,
      }) => {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        params.append('offset', offset.toString());
        if (processed !== undefined)
          params.append('processed', processed.toString());
        if (failed) params.append('failed', 'true');
        if (type) params.append('type', type);
        return `/admin/webhooks/events?${params.toString()}`;
      },
      providesTags: ['AdminDashboard'],
    }),

    getWebhookEvent: builder.query<{ event: any }, string>({
      query: (id) => `/admin/webhooks/events/${id}`,
    }),

    retryWebhookEvent: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/admin/webhooks/events/${id}/retry`,
        method: 'POST',
      }),
      invalidatesTags: ['AdminDashboard'],
    }),

    getWebhookErrors: builder.query<
      { errors: any[] },
      { limit?: number }
    >({
      query: ({ limit = 20 } = {}) =>
        `/admin/webhooks/errors?limit=${limit}`,
      providesTags: ['AdminDashboard'],
    }),

    // Promo Codes
    getPromoCodes: builder.query<
      { codes: any[]; total: number },
      { active?: boolean; limit?: number; offset?: number }
    >({
      query: ({ active, limit, offset } = {}) => {
        const params = new URLSearchParams();
        if (active !== undefined)
          params.append('active', active.toString());
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        return `/promo-codes?${params.toString()}`;
      },
    }),

    createPromoCode: builder.mutation<
      any,
      {
        code: string;
        name: string;
        description?: string;
        percentOff?: number;
        amountOff?: number;
        currency?: string;
        duration: 'forever' | 'once' | 'repeating';
        durationInMonths?: number;
        maxRedemptions?: number;
        redeemBy?: Date;
      }
    >({
      query: (data) => ({
        url: '/promo-codes',
        method: 'POST',
        body: data,
      }),
    }),

    deactivatePromoCode: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/promo-codes/${id}/deactivate`,
        method: 'PATCH',
      }),
    }),

    deletePromoCode: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/promo-codes/${id}`,
        method: 'DELETE',
      }),
    }),
  }),
});

export const {
  useGetAdminDashboardQuery,
  useGetAdminMetricsQuery,
  useGetAdminRevenueQuery,
  useGetAdminTransactionsQuery,
  useGetAdminUsersQuery,
  useGetAdminUserDetailsQuery,
  useSuspendUserMutation,
  useGetWebhookStatsQuery,
  useGetWebhookEventsQuery,
  useGetWebhookEventQuery,
  useRetryWebhookEventMutation,
  useGetWebhookErrorsQuery,
  useGetPromoCodesQuery,
  useCreatePromoCodeMutation,
  useDeactivatePromoCodeMutation,
  useDeletePromoCodeMutation,
} = adminApi;
