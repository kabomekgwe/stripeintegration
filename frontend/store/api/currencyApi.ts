import { baseApi } from './baseApi';

/**
 * Currency API
 *
 * Endpoints for currency conversion and exchange rates.
 * 
 * Cache Strategy:
 * - getCurrencies: Persist (static data, rarely changes)
 * - detectCurrency: Persist (IP-based, same per session)
 * - convertCurrency: Persist (rates cached until invalidated)
 * - validatePromoCode: Persist (promo codes don't change often)
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
      // Data persists until manually invalidated
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
      // Data persists until manually invalidated
    }),

    convertCurrency: builder.query<{
      original: { amount: number; currency: string; formatted: string };
      converted: { amount: number; currency: string; formatted: string };
      rate: number;
      timestamp: string;
    }, { amount: number; from: string; to: string }>({
      query: ({ amount, from, to }) =>
        `/currency/convert?amount=${amount}&from=${from}&to=${to}`,
      // Data persists until manually invalidated
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
      // Data persists until manually invalidated
    }),
  }),
});

export const {
  useGetCurrenciesQuery,
  useDetectCurrencyQuery,
  useConvertCurrencyQuery,
  useValidatePromoCodeQuery,
} = currencyApi;
