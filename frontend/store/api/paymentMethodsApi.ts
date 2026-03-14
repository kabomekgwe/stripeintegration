import { baseApi } from './baseApi';
import type { PaymentMethod, SetupIntentResponse } from '@/types';

/**
 * Payment Methods API
 *
 * Endpoints for managing saved payment methods (cards, bank accounts).
 *
 * Cache Strategy:
 * - getPaymentMethods: 2 minutes (payment methods change when added/removed)
 * - Mutations: no cache (actions)
 */
export const paymentMethodsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPaymentMethods: builder.query<{ paymentMethods: PaymentMethod[] }, void>({
      query: () => '/payment-methods',
      providesTags: ['PaymentMethods'],
      keepUnusedDataFor: 120, // Cache for 2 minutes
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
  }),
});

export const {
  useGetPaymentMethodsQuery,
  useCreateSetupIntentMutation,
  useSavePaymentMethodMutation,
  useSetDefaultPaymentMethodMutation,
  useRemovePaymentMethodMutation,
} = paymentMethodsApi;
