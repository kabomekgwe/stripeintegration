import { baseApi } from './baseApi';
import type { Payment, PaymentIntentResponse, CreatePaymentRequest } from '@/types';

/**
 * Payments API
 *
 * Endpoints for payment processing, refunds, and invoices.
 */
export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPayments: builder.query<{ payments: Payment[] }, void>({
      query: () => '/payments',
      providesTags: ['Payments'],
    }),

    getPayment: builder.query<{ payment: Payment | null }, string>({
      query: (id) => `/payments/${id}`,
    }),

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
  }),
});

export const {
  useGetPaymentsQuery,
  useGetPaymentQuery,
  useCreatePaymentIntentMutation,
  useConfirmPaymentMutation,
  useRetryPaymentMutation,
  useCreateRefundMutation,
  useGetPaymentRefundsQuery,
  useGetAllRefundsQuery,
  useLazyDownloadPaymentInvoiceQuery,
  useLazyDownloadUsageInvoiceQuery,
  useLazyViewPaymentInvoiceQuery,
} = paymentsApi;
