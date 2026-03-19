import { baseApi } from './baseApi';
import type { Payment, PaymentIntentResponse, CheckoutSessionResponse, CreatePaymentRequest } from '@/types';

/**
 * Payments API
 *
 * Endpoints for payment processing, refunds, and invoices.
 *
 * Cache Strategy:
 * - getPayments: Persist until 'Payments' tag invalidated
 * - getPayment: Persist until 'Payments' tag invalidated
 * - Mutations: Invalidate 'Payments' tag
 * - Lazy queries: No cache (downloads)
 *
 * Idempotency:
 * - All mutation endpoints support Idempotency-Key header
 * - Frontend generates UUID v4 for each payment intent
 * - Retries with same key return cached response
 */

// Helper to generate UUID v4
export const generateIdempotencyKey = (): string => {
  return crypto.randomUUID();
};


export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPayments: builder.query<{ payments: Payment[] }, void>({
      query: () => '/payments',
      providesTags: ['Payments'],
    }),

    getPayment: builder.query<{ payment: Payment | null }, string>({
      query: (id) => `/payments/${id}`,
      providesTags: (result, error, id) => [{ type: 'Payments', id }],
    }),

    createPaymentIntent: builder.mutation<
      PaymentIntentResponse,
      { request: CreatePaymentRequest; idempotencyKey: string }
    >({
      query: ({ request, idempotencyKey }) => ({
        url: '/payments/intent',
        method: 'POST',
        body: request,
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }),
      async onQueryStarted({ request, idempotencyKey }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          console.log('[Idempotency] Payment intent created:', {
            idempotencyKey,
            paymentIntentId: data.paymentIntentId,
          });
        } catch (err) {
          console.log('[Idempotency] Payment intent error:', {
            idempotencyKey,
            error: err,
          });
        }
      },
    }),

    createCheckoutSession: builder.mutation<
      CheckoutSessionResponse,
      { request: CreatePaymentRequest; idempotencyKey: string }
    >({
      query: ({ request, idempotencyKey }) => ({
        url: '/payments/checkout-session',
        method: 'POST',
        body: request,
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
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
      {
        paymentId: string;
        idempotencyKey: string;
        amount?: number;
        reason?: string;
        description?: string;
      }
    >({
      query: ({ paymentId, idempotencyKey, ...data }) => ({
        url: `/payments/${paymentId}/refund`,
        method: 'POST',
        body: data,
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
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
  useCreateCheckoutSessionMutation,
  useConfirmPaymentMutation,
  useRetryPaymentMutation,
  useCreateRefundMutation,
  useGetPaymentRefundsQuery,
  useGetAllRefundsQuery,
  useLazyDownloadPaymentInvoiceQuery,
  useLazyDownloadUsageInvoiceQuery,
  useLazyViewPaymentInvoiceQuery,
} = paymentsApi;

