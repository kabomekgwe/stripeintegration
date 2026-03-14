# RTK Query Hooks Usage Map

This document maps all exported RTK Query hooks to their usage locations in the project.

## Auth API (`store/api/authApi.ts`)

| Hook | Used In | Purpose |
|------|---------|---------|
| `useLoginMutation` | `app/auth/login/page.tsx` | User login |
| `useRegisterMutation` | `app/auth/register/page.tsx` | User registration |
| `useLogoutMutation` | `components/Navbar.tsx` | User logout |
| `useGetMeQuery` | `app/dashboard/layout.tsx`, `app/settings/page.tsx`, `app/payments/make/page.tsx`, `components/Navbar.tsx` | Get current user |
| `useRequestPasswordResetMutation` | `app/auth/forgot-password/page.tsx` | Request password reset |
| `useResetPasswordMutation` | `app/auth/reset-password/ResetPasswordForm.tsx` | Reset password |
| `useUpdatePreferredCurrencyMutation` | `app/settings/page.tsx`, `app/payments/make/page.tsx`, `components/Navbar.tsx` | Update currency preference |
| `useUpdateCountryMutation` | `app/settings/page.tsx` | Update country |

## Payment Methods API (`store/api/paymentMethodsApi.ts`)

| Hook | Used In | Purpose |
|------|---------|---------|
| `useGetPaymentMethodsQuery` | `app/payment-methods/page.tsx`, `app/payments/make/page.tsx` | List saved payment methods |
| `useCreateSetupIntentMutation` | `app/payment-methods/add/page.tsx` | Create setup intent for adding card |
| `useSavePaymentMethodMutation` | `app/payment-methods/add/page.tsx` | Save new payment method |
| `useSetDefaultPaymentMethodMutation` | `app/payment-methods/page.tsx` | Set default payment method |
| `useRemovePaymentMethodMutation` | `app/payment-methods/page.tsx` | Remove payment method |

## Payments API (`store/api/paymentsApi.ts`)

| Hook | Used In | Purpose |
|------|---------|---------|
| `useGetPaymentsQuery` | `app/payments/page.tsx` | List user payments |
| `useGetPaymentQuery` | `app/payments/[id]/page.tsx` | Get single payment details |
| `useCreatePaymentIntentMutation` | `app/payments/make/page.tsx` | Create payment intent |
| `useConfirmPaymentMutation` | `components/stripe/PaymentElementForm.tsx` | Confirm payment |
| `useRetryPaymentMutation` | `app/payments/[id]/page.tsx` | Retry failed payment |
| `useCreateRefundMutation` | `app/payments/[id]/page.tsx` | Create refund |
| `useGetPaymentRefundsQuery` | `app/payments/[id]/page.tsx` | Get refunds for payment |
| `useGetAllRefundsQuery` | `app/admin/page.tsx` | Get all refunds (admin) |
| `useLazyDownloadPaymentInvoiceQuery` | `app/payments/[id]/page.tsx` | Download invoice |
| `useLazyDownloadUsageInvoiceQuery` | `app/payments/[id]/page.tsx` | Download usage invoice |
| `useLazyViewPaymentInvoiceQuery` | `app/payments/[id]/page.tsx` | View invoice |

## Usage API (`store/api/usageApi.ts`)

| Hook | Used In | Purpose |
|------|---------|---------|
| `useGetUsageQuery` | `app/usage/page.tsx` | Get usage records |
| `useRecordUsageMutation` | `app/usage/page.tsx` | Record new usage |
| `useGetBillingPreviewQuery` | `app/usage/page.tsx` | Get billing preview |
| `useGenerateBillingMutation` | `app/usage/page.tsx` | Generate billing |
| `useRunMonthlyBillingMutation` | `app/admin/page.tsx` | Run monthly billing (admin) |

## Subscriptions API (`store/api/subscriptionsApi.ts`)

| Hook | Used In | Purpose |
|------|---------|---------|
| `useGetSubscriptionPlansQuery` | `app/subscriptions/page.tsx` | List subscription plans |
| `useGetSubscriptionQuery` | `app/subscriptions/page.tsx` | Get current subscription |
| `useCreateSubscriptionMutation` | `app/subscriptions/page.tsx` | Create subscription |
| `useUpdateSubscriptionMutation` | `app/subscriptions/page.tsx` | Update subscription |
| `useCancelSubscriptionMutation` | `app/subscriptions/page.tsx` | Cancel subscription |
| `useCreatePortalSessionMutation` | `app/settings/page.tsx` | Create Stripe portal session |
| `useCreateUsageSubscriptionMutation` | `app/subscriptions/page.tsx` | Create usage-based subscription |
| `useRecordMeteredUsageMutation` | `app/subscriptions/page.tsx` | Record metered usage |
| `useGetUsageSummaryQuery` | `app/subscriptions/page.tsx` | Get usage summary |

## Admin API (`store/api/adminApi.ts`)

| Hook | Used In | Purpose |
|------|---------|---------|
| `useGetAdminDashboardQuery` | `app/admin/page.tsx` | Get admin dashboard data |
| `useGetAdminMetricsQuery` | `app/admin/page.tsx` | Get admin metrics |
| `useGetAdminRevenueQuery` | `app/admin/page.tsx` | Get revenue stats |
| `useGetAdminTransactionsQuery` | `app/admin/page.tsx` | Get transactions |
| `useGetAdminUsersQuery` | `app/admin/users/page.tsx` | List users |
| `useGetAdminUserDetailsQuery` | `app/admin/users/[id]/page.tsx` | Get user details |
| `useSuspendUserMutation` | `app/admin/users/[id]/page.tsx` | Suspend user |
| `useGetWebhookStatsQuery` | `app/admin/webhooks/page.tsx` | Get webhook stats |
| `useGetWebhookEventsQuery` | `app/admin/webhooks/page.tsx` | List webhook events |
| `useGetWebhookEventQuery` | `app/admin/webhooks/[id]/page.tsx` | Get webhook event details |
| `useRetryWebhookEventMutation` | `app/admin/webhooks/[id]/page.tsx` | Retry webhook event |
| `useGetWebhookErrorsQuery` | `app/admin/webhooks/page.tsx` | Get webhook errors |
| `useGetPromoCodesQuery` | `app/admin/promo-codes/page.tsx` | List promo codes |
| `useCreatePromoCodeMutation` | `app/admin/promo-codes/page.tsx` | Create promo code |
| `useDeactivatePromoCodeMutation` | `app/admin/promo-codes/page.tsx` | Deactivate promo code |
| `useDeletePromoCodeMutation` | `app/admin/promo-codes/page.tsx` | Delete promo code |

## Currency API (`store/api/currencyApi.ts`)

| Hook | Used In | Purpose |
|------|---------|---------|
| `useGetCurrenciesQuery` | `app/payments/make/page.tsx`, `components/Navbar.tsx` | List available currencies |
| `useDetectCurrencyQuery` | `app/payments/make/page.tsx` | Detect currency from IP |
| `useConvertCurrencyQuery` | `app/payments/make/page.tsx` | Convert currency amounts |
| `useValidatePromoCodeQuery` | `app/payments/make/page.tsx` | Validate promo code |

## Disputes API (`store/api/disputesApi.ts`)

| Hook | Used In | Purpose |
|------|---------|---------|
| `useGetDisputesQuery` | `app/admin/disputes/page.tsx` | List all disputes (admin) |
| `useGetMyDisputesQuery` | `app/disputes/page.tsx` | Get user's disputes |
| `useGetDisputeStatsQuery` | `app/admin/disputes/page.tsx` | Get dispute stats |
| `useGetDisputeQuery` | `app/admin/disputes/[id]/page.tsx`, `app/disputes/[id]/page.tsx` | Get dispute details |
| `useSubmitDisputeEvidenceMutation` | `app/admin/disputes/[id]/page.tsx` | Submit dispute evidence |
| `useCloseDisputeMutation` | `app/admin/disputes/[id]/page.tsx` | Close dispute |

## Connect API (`store/api/connectApi.ts`)

| Hook | Used In | Purpose |
|------|---------|---------|
| `useCreateConnectedAccountMutation` | `app/connect/onboard/page.tsx` | Create connected account |
| `useGetConnectedAccountQuery` | `app/connect/page.tsx` | Get connected account |
| `useCreateOnboardingLinkMutation` | `app/connect/page.tsx` | Create onboarding link |
| `useCreateLoginLinkMutation` | `app/connect/page.tsx` | Create Express login link |
| `useCreateDirectChargeMutation` | `app/connect/charge/page.tsx` | Create direct charge |
| `useGetPlatformBalanceQuery` | `app/connect/page.tsx` | Get platform balance |

---

## Summary Statistics

- **Total API Slices**: 10
- **Total Hooks Exported**: 70+
- **Total Hooks Used**: 70+ (100% utilization)
- **Files Using Hooks**: 25+

## Benefits of This Architecture

1. **Automatic Caching**: RTK Query caches responses and reuses them
2. **Automatic Refetching**: Data stays fresh with cache invalidation
3. **Type Safety**: Full TypeScript support across the API
4. **No Boilerplate**: No need to write actions/reducers for API calls
5. **Optimistic Updates**: UI updates immediately before server response
6. **Error Handling**: Built-in error states for every endpoint
7. **Loading States**: Built-in loading states for every endpoint
8. **DevTools**: Redux DevTools show all API calls and cache state
