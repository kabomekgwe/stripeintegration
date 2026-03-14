import { baseApi } from './baseApi';

/**
 * Disputes API
 *
 * Endpoints for chargeback and dispute management.
 */
export const disputesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDisputes: builder.query<
      { disputes: any[]; total: number },
      { status?: string; limit?: number; offset?: number }
    >({
      query: ({ status, limit, offset } = {}) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        return `/disputes?${params.toString()}`;
      },
    }),

    getMyDisputes: builder.query<
      { disputes: any[]; total: number },
      { limit?: number; offset?: number }
    >({
      query: ({ limit, offset } = {}) => {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        return `/disputes/my-disputes?${params.toString()}`;
      },
    }),

    getDisputeStats: builder.query<{
      total: number;
      needsResponse: number;
      won: number;
      lost: number;
      totalAmount: number;
      byReason: Record<string, number>;
    }, void>({
      query: () => '/disputes/stats',
    }),

    getDispute: builder.query<any, string>({
      query: (id) => `/disputes/${id}`,
    }),

    submitDisputeEvidence: builder.mutation<
      { message: string },
      {
        id: string;
        evidence: {
          productDescription?: string;
          customerCommunication?: string;
          refundPolicy?: string;
          termsOfService?: string;
          shippingDocumentation?: string;
          serviceDocumentation?: string;
          uncategorizedText?: string;
          receipt?: string;
        };
      }
    >({
      query: ({ id, evidence }) => ({
        url: `/disputes/${id}/evidence`,
        method: 'POST',
        body: evidence,
      }),
    }),

    closeDispute: builder.mutation<
      { message: string },
      { id: string; outcome: 'won' | 'lost' }
    >({
      query: ({ id, outcome }) => ({
        url: `/disputes/${id}/close`,
        method: 'POST',
        body: { outcome },
      }),
    }),
  }),
});

export const {
  useGetDisputesQuery,
  useGetMyDisputesQuery,
  useGetDisputeStatsQuery,
  useGetDisputeQuery,
  useSubmitDisputeEvidenceMutation,
  useCloseDisputeMutation,
} = disputesApi;
