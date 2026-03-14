import { baseApi } from './baseApi';

/**
 * Currency API
 *
 * Endpoints for currency conversion and exchange rates.
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
  }),
});

export const {
  useGetCurrenciesQuery,
  useDetectCurrencyQuery,
  useConvertCurrencyQuery,
  useValidatePromoCodeQuery,
} = currencyApi;
