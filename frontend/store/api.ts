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
  tagTypes: ['User', 'PaymentMethods', 'Payments', 'Usage', 'BillingPreview'],
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
  useRecordUsageMutation,
  useGetUsageQuery,
  useGetBillingPreviewQuery,
  useGenerateBillingMutation,
  useRunMonthlyBillingMutation,
} = api;
