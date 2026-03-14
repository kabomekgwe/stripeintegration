import { baseApi } from './baseApi';

/**
 * Currency API
 *
 * Endpoints for currency conversion and exchange rates.
 * 
 * Cache Strategy:
 * - getCurrencies: 5 minutes (static data)
 * - detectCurrency: no cache (IP-based, varies by user)
 * - convertCurrency: 1 minute (rates change frequently)
 * - validatePromoCode: no cache (validation should be fresh)
 */
export const currencyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
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
      keepUnusedDataFor: 300, // Cache for 5 minutes (static data)
    }),

    detectCurrency: builder.query<{
      ip: string;
      country: string;
      suggestedCurrency: string;
      currency: {
        code: string;
        name: string;
        symbol: string;
      } | null;
      note: string;
    }, void>({
      query: () => '/currency/detect',
      keepUnusedDataFor: 0, // No cache (IP-based detection)
    }),

    convertCurrency: builder.query<{
      original: { amount: number; currency: string; formatted: string };
      converted: { amount: number; currency: string; formatted: string };
      rate: number;
      timestamp: string;
    }, { amount: number; from: string; to: string }>({
      query: ({ amount, from, to }) =>
        `/currency/convert?amount=${amount}&from=${from}&to=${to}`,
      keepUnusedDataFor: 60, // Cache for 1 minute (exchange rates)
    }),

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
      keepUnusedDataFor: 0, // No cache (validation should always be fresh)
    }),
  }),
});

export const {
  useGetCurrenciesQuery,
  useDetectCurrencyQuery,
  useConvertCurrencyQuery,
  useValidatePromoCodeQuery,
} = currencyApi;
