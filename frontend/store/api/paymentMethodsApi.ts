import { baseApi } from './baseApi';
import type { PaymentMethod, SetupIntentResponse } from '@/types';

/**
 * Payment Methods API
 *
 * Endpoints for managing saved payment methods (cards, bank accounts).
 *
 * Cache Strategy:
 * - getPaymentMethods: Persist until 'PaymentMethods' tag invalidated
 * - Mutations: Invalidate 'PaymentMethods' and 'User' tags
 */
export const paymentMethodsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPaymentMethods: builder.query<{ paymentMethods: PaymentMethod[] }, void>({
      query: () => '/payment-methods',
      providesTags: ['PaymentMethods'],
    }),

    getEnabledPaymentMethods: builder.query<{
      paymentMethodConfigurations: Array<{
        id: string;
        displayName: string;
        parent?: string;
        active: boolean;
      }>;
    }, void>({
      query: () => '/payment-methods/enabled',
    }),

    createSetupIntent: builder.mutation<SetupIntentResponse, { paymentMethodId?: string } | void>({
      query: (body) => ({
        url: '/payment-methods/setup-intent',
        method: 'POST',
        body: body || {},
      }),
    }),

    checkPaymentMethodDuplicate: builder.mutation<{
      isDuplicate: boolean;
      existingMethod?: PaymentMethod;
    }, string>({
      query: (paymentMethodId) => ({
        url: '/payment-methods/check-duplicate',
        method: 'POST',
        body: { paymentMethodId },
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
  useGetEnabledPaymentMethodsQuery,
  useCreateSetupIntentMutation,
  useCheckPaymentMethodDuplicateMutation,
  useSavePaymentMethodMutation,
  useSetDefaultPaymentMethodMutation,
  useRemovePaymentMethodMutation,
} = paymentMethodsApi;
