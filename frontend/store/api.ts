import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  User,
  PaymentMethod,
  Payment,
  UsageRecord,
  BillingPreview,
  AuthResponse,
  CreatePaymentRequest,
  PaymentIntentResponse,
  SetupIntentResponse,
  CreateUsageRequest,
  BillingResult,
  MonthlyBillingResult,
} from '@/types';

// Get token from localStorage
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    prepareHeaders: (headers) => {
      const token = getToken();
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['User', 'PaymentMethods', 'Payments', 'Usage', 'BillingPreview', 'AdminDashboard', 'Subscriptions'],
  endpoints: (builder) => ({
    // Auth endpoints
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    register: builder.mutation<AuthResponse, { email: string; password: string; name?: string }>({
      query: (userData) => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
    }),
    logout: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
    }),
    getMe: builder.query<User, void>({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),
    requestPasswordReset: builder.mutation<{ message: string }, { email: string }>({
      query: (data) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: data,
      }),
    }),
    resetPassword: builder.mutation<{ message: string }, { token: string; newPassword: string }>({
      query: (data) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body: data,
      }),
    }),

    // Payment Methods endpoints
    getPaymentMethods: builder.query<{ paymentMethods: PaymentMethod[] }, void>({
      query: () => '/payment-methods',
      providesTags: ['PaymentMethods'],
    }),
    createSetupIntent: builder.mutation<SetupIntentResponse, void>({
      query: () => ({
        url: '/payment-methods/setup-intent',
        method: 'POST',
      }),
    }),
    savePaymentMethod: builder.mutation<{ paymentMethod: PaymentMethod }, string>({
      query: (paymentMethodId) => ({
        url: '/payment-methods/save',
        method: 'POST',
        body: { paymentMethodId },
      }),
      invalidatesTags: ['PaymentMethods', 'User'],
    }),
    setDefaultPaymentMethod: builder.mutation<{ paymentMethod: PaymentMethod }, string>({
      query: (id) => ({
        url: `/payment-methods/${id}/default`,
        method: 'POST',
      }),
      invalidatesTags: ['PaymentMethods', 'User'],
    }),
    removePaymentMethod: builder.mutation<{ paymentMethod: PaymentMethod }, string>({
      query: (id) => ({
        url: `/payment-methods/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PaymentMethods', 'User'],
    }),

    // Payments endpoints
    createPaymentIntent: builder.mutation<PaymentIntentResponse, CreatePaymentRequest>({
      query: (data) => ({
        url: '/payments/intent',
        method: 'POST',
        body: data,
      }),
    }),
    confirmPayment: builder.mutation<{ payment: Payment }, string>({
      query: (id) => ({
        url: `/payments/${id}/confirm`,
        method: 'POST',
      }),
      invalidatesTags: ['Payments'],
    }),
    getPayments: builder.query<{ payments: Payment[] }, void>({
      query: () => '/payments',
      providesTags: ['Payments'],
    }),
    getPayment: builder.query<{ payment: Payment | null }, string>({
      query: (id) => `/payments/${id}`,
    }),
    retryPayment: builder.mutation<{ payment: Payment }, string>({
      query: (id) => ({
        url: `/payments/${id}/retry`,
        method: 'POST',
      }),
      invalidatesTags: ['Payments'],
    }),
    createRefund: builder.mutation<
      { refund: any; remainingRefundable: number },
      { paymentId: string; amount?: number; reason?: string; description?: string }
    >({
      query: ({ paymentId, ...data }) => ({
        url: `/payments/${paymentId}/refund`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Payments'],
    }),
    getPaymentRefunds: builder.query<{ refunds: any[] }, string>({
      query: (paymentId) => `/payments/${paymentId}/refunds`,
    }),
    getAllRefunds: builder.query<{ refunds: any[] }, void>({
      query: () => '/payments/refunds/all',
    }),

    // Invoice endpoints
    downloadPaymentInvoice: builder.query<Blob, string>({
      query: (paymentId) => ({
        url: `/invoices/payment/${paymentId}`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    downloadUsageInvoice: builder.query<Blob, string>({
      query: (usageId) => ({
        url: `/invoices/usage/${usageId}`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    viewPaymentInvoice: builder.query<Blob, string>({
      query: (paymentId) => ({
        url: `/invoices/payment/${paymentId}/view`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Usage endpoints
    recordUsage: builder.mutation<{ usage: UsageRecord }, CreateUsageRequest>({
      query: (data) => ({
        url: '/usage',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Usage', 'BillingPreview'],
    }),
    getUsage: builder.query<{ usage: UsageRecord[] }, void>({
      query: () => '/usage',
      providesTags: ['Usage'],
    }),
    getBillingPreview: builder.query<{ preview: BillingPreview | null }, void>({
      query: () => '/usage/preview',
      providesTags: ['BillingPreview'],
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

    // Admin endpoints
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
    getAdminRevenue: builder.query<any, { period?: 'day' | 'week' | 'month'; days?: number }>({
      query: ({ period = 'day', days = 30 }) => `/admin/revenue?period=${period}&days=${days}`,
      providesTags: ['AdminDashboard'],
    }),
    getAdminTransactions: builder.query<{ transactions: any[] }, { limit?: number }>({
      query: ({ limit = 20 }) => `/admin/transactions?limit=${limit}`,
    }),
    getAdminUsers: builder.query<{
      users: any[];
      total: number;
    }, { page?: number; limit?: number; search?: string }>({
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
    suspendUser: builder.mutation<{ message: string; userId: string }, string>({
      query: (userId) => ({
        url: `/admin/users/${userId}/suspend`,
        method: 'POST',
      }),
    }),

    // Subscription endpoints
    getSubscriptionPlans: builder.query<{
      plans: any[];
    }, void>({
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
    createSubscription: builder.mutation<{ clientSecret: string; subscriptionId: string }, { priceId: string; paymentMethodId?: string }>({
      query: (data) => ({
        url: '/subscriptions',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Subscriptions'],
    }),
    updateSubscription: builder.mutation<{ message: string }, { id: string; priceId?: string; cancelAtPeriodEnd?: boolean }>({
      query: ({ id, ...data }) => ({
        url: `/subscriptions/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Subscriptions'],
    }),
    cancelSubscription: builder.mutation<{ message: string }, { id: string; cancelMode?: 'immediately' | 'period_end' }>({
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

    // Currency
    getCurrencies: builder.query<{
      currencies: Array<{
        code: string;
        name: string;
        symbol: string;
        minAmount: number;
        maxAmount: number;
      }>;
      default: string;
    }, void>({
      query: () => '/currency',
    }),
    convertCurrency: builder.query<{
      original: { amount: number; currency: string; formatted: string };
      converted: { amount: number; currency: string; formatted: string };
      rate: number;
      timestamp: string;
    }, { amount: number; from: string; to: string }>({
      query: ({ amount, from, to }) => 
        `/currency/convert?amount=${amount}&from=${from}&to=${to}`,
    }),

    // Admin Webhooks Dashboard
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
    }, { limit?: number; offset?: number; processed?: boolean; failed?: boolean; type?: string }>({
      query: ({ limit = 50, offset = 0, processed, failed, type }) => {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        params.append('offset', offset.toString());
        if (processed !== undefined) params.append('processed', processed.toString());
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
    getWebhookErrors: builder.query<{ errors: any[] }, { limit?: number }>({
      query: ({ limit = 20 } = {}) => `/admin/webhooks/errors?limit=${limit}`,
      providesTags: ['AdminDashboard'],
    }),

    // Promo Codes
    validatePromoCode: builder.query<{
      valid: boolean;
      code?: string;
      name?: string;
      description?: string;
      percentOff?: number;
      amountOff?: number;
      currency?: string;
      duration?: string;
      durationInMonths?: number;
      error?: string;
    }, string>({
      query: (code) => `/promo-codes/validate/${code}`,
    }),
    getPromoCodes: builder.query<{
      codes: any[];
      total: number;
    }, { active?: boolean; limit?: number; offset?: number }>({
      query: ({ active, limit, offset } = {}) => {
        const params = new URLSearchParams();
        if (active !== undefined) params.append('active', active.toString());
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        return `/promo-codes?${params.toString()}`;
      },
    }),
    createPromoCode: builder.mutation<any, {
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
    }>({
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

// Export hooks
export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetMeQuery,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
  useGetPaymentMethodsQuery,
  useCreateSetupIntentMutation,
  useSavePaymentMethodMutation,
  useSetDefaultPaymentMethodMutation,
  useRemovePaymentMethodMutation,
  useCreatePaymentIntentMutation,
  useConfirmPaymentMutation,
  useGetPaymentsQuery,
  useGetPaymentQuery,
  useRetryPaymentMutation,
  useCreateRefundMutation,
  useGetPaymentRefundsQuery,
  useGetAllRefundsQuery,
  useLazyDownloadPaymentInvoiceQuery,
  useLazyDownloadUsageInvoiceQuery,
  useLazyViewPaymentInvoiceQuery,
  useRecordUsageMutation,
  useGetUsageQuery,
  useGetBillingPreviewQuery,
  useGenerateBillingMutation,
  useRunMonthlyBillingMutation,
  // Admin hooks
  useGetAdminDashboardQuery,
  useGetAdminMetricsQuery,
  useGetAdminRevenueQuery,
  useGetAdminTransactionsQuery,
  useGetAdminUsersQuery,
  useGetAdminUserDetailsQuery,
  useSuspendUserMutation,
  // Subscription hooks
  useGetSubscriptionPlansQuery,
  useGetSubscriptionQuery,
  useCreateSubscriptionMutation,
  useUpdateSubscriptionMutation,
  useCancelSubscriptionMutation,
  // Customer Portal
  useCreatePortalSessionMutation,
  // Currency
  useGetCurrenciesQuery,
  useConvertCurrencyQuery,
  // Admin Webhooks
  useGetWebhookStatsQuery,
  useGetWebhookEventsQuery,
  useGetWebhookEventQuery,
  useRetryWebhookEventMutation,
  useGetWebhookErrorsQuery,
  // Promo Codes
  useValidatePromoCodeQuery,
  useGetPromoCodesQuery,
  useCreatePromoCodeMutation,
  useDeactivatePromoCodeMutation,
  useDeletePromoCodeMutation,
} = api;
