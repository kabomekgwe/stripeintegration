import { baseApi } from './baseApi';

/**
 * Connect API
 *
 * Endpoints for Stripe Connect (marketplace & platform payments).
 */
export const connectApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createConnectedAccount: builder.mutation<
      { account: any; onboardingUrl?: string },
      {
        email: string;
        country: string;
        businessType?: 'individual' | 'company';
        individual?: {
          firstName: string;
          lastName: string;
          dob: { day: number; month: number; year: number };
          address: {
            line1: string;
            city: string;
            postalCode: string;
            country: string;
          };
        };
        company?: {
          name: string;
          taxId?: string;
          address: {
            line1: string;
            city: string;
            postalCode: string;
            country: string;
          };
        };
      }
    >({
      query: (data) => ({
        url: '/connect/accounts',
        method: 'POST',
        body: data,
      }),
    }),

    getConnectedAccount: builder.query<any, void>({
      query: () => '/connect/account',
      providesTags: ['Connect'],
    }),

    createOnboardingLink: builder.mutation<{ url: string }, void>({
      query: () => ({
        url: '/connect/onboarding-link',
        method: 'POST',
      }),
    }),

    createLoginLink: builder.mutation<{ url: string }, void>({
      query: () => ({
        url: '/connect/login-link',
        method: 'POST',
      }),
    }),

    createDirectCharge: builder.mutation<
      { paymentIntentId: string; clientSecret: string },
      {
        amount: number;
        currency: string;
        connectedAccountId: string;
        paymentMethodId: string;
        description?: string;
        applicationFeeAmount?: number;
      }
    >({
      query: (data) => ({
        url: '/connect/direct-charge',
        method: 'POST',
        body: data,
      }),
    }),

    getPlatformBalance: builder.query<{
      available: number;
      pending: number;
      currency: string;
    }, void>({
      query: () => '/connect/platform-balance',
    }),
  }),
});

export const {
  useCreateConnectedAccountMutation,
  useGetConnectedAccountQuery,
  useCreateOnboardingLinkMutation,
  useCreateLoginLinkMutation,
  useCreateDirectChargeMutation,
  useGetPlatformBalanceQuery,
} = connectApi;
