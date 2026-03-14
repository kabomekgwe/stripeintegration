import { baseApi } from './baseApi';
import type { User, AuthResponse } from '@/types';

/**
 * Authentication API
 * 
 * Endpoints for user authentication and profile management.
 * 
 * Cache Strategy:
 * - getMe: 5 minutes (user data changes infrequently)
 * - Mutations: no cache (actions, not data)
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, { email: string; password: string }>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),

    register: builder.mutation<
      AuthResponse, 
      { email: string; password: string; name?: string; country?: string }
    >({
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
      keepUnusedDataFor: 300, // Cache for 5 minutes
    }),

    requestPasswordReset: builder.mutation<{ message: string }, { email: string }>({
      query: (data) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: data,
      }),
    }),

    resetPassword: builder.mutation<
      { message: string }, 
      { token: string; newPassword: string }
    >({
      query: (data) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body: data,
      }),
    }),

    updatePreferredCurrency: builder.mutation<
      { message: string; preferredCurrency: string }, 
      string
    >({
      query: (currency) => ({
        url: '/auth/preferred-currency',
        method: 'PATCH',
        body: { currency },
      }),
      invalidatesTags: ['User'],
    }),

    updateCountry: builder.mutation<{
      message: string;
      user: User;
      suggestedCurrency: { currency: string; source: string };
    }, string>({
      query: (country) => ({
        url: '/auth/country',
        method: 'PATCH',
        body: { country },
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetMeQuery,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
  useUpdatePreferredCurrencyMutation,
  useUpdateCountryMutation,
} = authApi;
