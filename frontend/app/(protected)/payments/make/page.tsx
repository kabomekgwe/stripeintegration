'use client';

import { useState, useId, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import {
  useCreatePaymentIntentMutation,
  useConfirmPaymentMutation,
  useGetPaymentMethodsQuery,
  useGetMeQuery,
  useConvertCurrencyQuery,
  generateIdempotencyKey,
} from '@/store/api';
import { getStripe } from '@/lib/stripe-client';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { COUNTRY_CURRENCY } from '@/lib/countries';

// Custom hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// All currencies supported by Stripe FX Quotes API (170+ currencies)
// Source: https://docs.stripe.com/payouts/cross-border-payouts/supported-currencies
const SUPPORTED_CURRENCIES = [
  'aed', 'afn', 'all', 'amd', 'ang', 'aoa', 'ars', 'aud', 'awg', 'azn',
  'bam', 'bbd', 'bdt', 'bgn', 'bhd', 'bif', 'bmd', 'bnd', 'bob', 'brl',
  'bsd', 'btn', 'bwp', 'byn', 'bzd', 'cad', 'cdf', 'chf', 'clp', 'cny',
  'cop', 'crc', 'cup', 'cve', 'czk', 'dkk', 'djf', 'dop', 'dzd', 'egp',
  'ern', 'etb', 'eur', 'fjd', 'fkp', 'gbp', 'gel', 'ghs', 'gip', 'gmd',
  'gnf', 'gtq', 'gyd', 'hkd', 'hnl', 'hrk', 'htg', 'huf', 'idr', 'ils',
  'inr', 'iqd', 'irr', 'isk', 'jmd', 'jod', 'jpy', 'kes', 'kgs', 'khr',
  'kmf', 'kpw', 'krw', 'kwd', 'kyd', 'kzt', 'lak', 'lbp', 'lkr', 'lrd',
  'lsl', 'lyd', 'mad', 'mdl', 'mga', 'mkd', 'mmk', 'mnt', 'mop', 'mru',
  'mur', 'mvr', 'mwk', 'mxn', 'myr', 'mzn', 'nad', 'ngn', 'nio', 'nok',
  'nzd', 'omr', 'pab', 'pen', 'pgk', 'php', 'pkr', 'pln', 'pyg', 'qar',
  'ron', 'rsd', 'rub', 'rwf', 'sar', 'sbd', 'scr', 'sdg', 'sek', 'sgd',
  'shp', 'sll', 'sos', 'srd', 'ssp', 'stn', 'syp', 'szl', 'thb', 'tjs',
  'tmt', 'tnd', 'top', 'try', 'ttd', 'twd', 'tzs', 'uah', 'ugx', 'usd',
  'uyu', 'uzs', 'ves', 'vnd', 'vuv', 'wst', 'xaf', 'xcd', 'xdr', 'xof',
  'xpf', 'yer', 'zar', 'zmw', 'zwl',
];

import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

function PaymentForm({
  amount,
  description,
  paymentIntentId,
  onSuccess,
  onCancel,
  localCurrency,
  convertedAmount,
  idempotencyKey,
}: {
  amount: number;
  description: string;
  paymentIntentId: string;
  onSuccess: () => void;
  onCancel: () => void;
  localCurrency?: string;
  convertedAmount?: { amount: number; currency: string; formatted: string };
  idempotencyKey: string;
}) {
  const amountId = useId();
  const descriptionId = useId();
  const stripe = useStripe();
  const elements = useElements();
  const [confirmPayment] = useConfirmPaymentMutation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'An error occurred');
      setIsLoading(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      await confirmPayment(paymentIntentId);
      onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Idempotency key indicator */}
      <div className="text-xs text-gray-400 mb-4">
        Idempotency key: {idempotencyKey}
      </div>

      {/* Step 1 fields — read-only summary */}
      <div>
        <label htmlFor={amountId} className="block text-sm font-medium text-gray-700 mb-2">
          Amount (£)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
          <input
            id={amountId}
            type="text"
            readOnly
            value={amount.toFixed(2)}
            className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
          />
        </div>
        {/* Show converted amount in user's currency */}
        {localCurrency && localCurrency !== 'gbp' && convertedAmount && (
          <p className="text-sm text-blue-600 font-medium mt-2">
            ≈ {convertedAmount.formatted} {convertedAmount.currency.toUpperCase()}
          </p>
        )}
      </div>

      {description && (
        <div>
          <label htmlFor={descriptionId} className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <input
            id={descriptionId}
            type="text"
            readOnly
            value={description}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
          />
        </div>
      )}

      <PaymentElement />

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isLoading}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Processing...' : 'Pay now'}
        </button>
      </div>
    </form>
  );
}

export default function MakePaymentPage() {
  const amountId = useId();
  const descriptionId = useId();

  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  const { data: paymentMethodsData } = useGetPaymentMethodsQuery();
  const [createPaymentIntent, { isLoading: creating, error: createError }] = useCreatePaymentIntentMutation();
  const { data: me } = useGetMeQuery();

  /**
   * Determine the user's local currency for display.
   * Only returns currencies supported by the backend conversion API.
   * Priority: 1) Country mapping → 2) Preferred currency → 3) undefined
   */
  const getLocalCurrency = (): string | undefined => {
    if (me?.country) {
      const fromCountry = COUNTRY_CURRENCY[me.country.toUpperCase()];
      if (fromCountry && SUPPORTED_CURRENCIES.includes(fromCountry)) {
        return fromCountry;
      }
    }
    if (me?.preferredCurrency) {
      const preferred = me.preferredCurrency.toLowerCase();
      if (SUPPORTED_CURRENCIES.includes(preferred)) {
        return preferred;
      }
    }
    return undefined;
  };

  const localCurrency = getLocalCurrency();
  
  useEffect(() => {
    console.log('[Currency Debug] Country:', me?.country, 'Preferred:', me?.preferredCurrency, 'Detected:', localCurrency);
  }, [me?.country, me?.preferredCurrency, localCurrency]);
  
  const debouncedAmount = useDebounce(amount, 300);
  
  const { data: converted, isFetching: isConverting } = useConvertCurrencyQuery(
    { amount: Math.round(debouncedAmount * 100), from: 'gbp', to: localCurrency ?? '' },
    { skip: !localCurrency || localCurrency === 'gbp' || debouncedAmount <= 0 },
  );

  useEffect(() => {
    if (converted) {
      console.log('[Conversion Debug] Response:', converted);
    }
  }, [converted]);

  const hasPaymentMethods = (paymentMethodsData?.paymentMethods?.length || 0) > 0;

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    // Generate idempotency key for this payment attempt
    const key = generateIdempotencyKey();
    setIdempotencyKey(key);
    console.log('[Idempotency] Generated key:', key);

    try {
      const result = await createPaymentIntent({
        request: {
          amount: Math.round(amount * 100),
          currency: 'gbp',
          description: description || 'Payment',
        },
        idempotencyKey: key,
      }).unwrap();

      setClientSecret(result.clientSecret);
      setPaymentIntentId(result.paymentIntentId);
    } catch (err) {
      console.error('Failed to create payment:', err);
    }
  };

  const handleCancel = () => {
    setClientSecret(null);
    setPaymentIntentId('');
    setIdempotencyKey('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-6">
          {clientSecret ? (
            <button
              type="button"
              onClick={handleCancel}
              className="text-blue-600 hover:underline text-sm cursor-pointer"
            >
              ← Back to Payment Details
            </button>
          ) : (
            <Link href="/payments" className="text-blue-600 hover:underline text-sm">
              ← Back to Payments
            </Link>
          )}
        </div>

        <h1 className="text-3xl font-bold mb-2">Make a Payment</h1>
        <p className="text-gray-600 mb-8">
          Enter the payment details below to process a one-time charge.
        </p>

        {!clientSecret && !hasPaymentMethods && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
            <p className="text-sm">
              You don&apos;t have any saved payment methods. Consider adding one first for faster checkout.
            </p>
            <Link
              href="/payment-methods/add"
              className="text-yellow-700 hover:underline text-sm mt-2 inline-block"
            >
              Add Payment Method →
            </Link>
          </div>
        )}

        {createError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Failed to create payment intent</p>
            <p className="text-sm mt-1">
              This could be due to a network issue or the idempotency key was rejected.
            </p>
            <p className="text-xs text-red-500 mt-2">
              Idempotency key: {idempotencyKey || 'Not generated'}
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          {/* Step 1: enter amount + description */}
          {!clientSecret && (
            <form onSubmit={handleContinue} className="space-y-6">
              <div>
                <label htmlFor={amountId} className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (£)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                  <input
                    type="number"
                    id={amountId}
                    step="0.01"
                    min="0.30"
                    required
                    value={amount || ''}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">Minimum: £0.30</p>
                {amount > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">
                      Detected currency: {localCurrency?.toUpperCase() || 'None (set country in settings)'}
                    </p>
                    {/* User has a currency and it's not GBP - show conversion */}
                    {localCurrency && localCurrency !== 'gbp' && (
                      <div className="flex items-center gap-2">
                        {isConverting ? (
                          <>
                            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                            <span className="text-gray-500 text-sm">Converting {amount} GBP...</span>
                          </>
                        ) : converted?.converted ? (
                          <span className="text-blue-600 font-semibold text-lg">
                            ≈ {converted.converted.formatted} {converted.converted.currency.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Conversion unavailable</span>
                        )}
                      </div>
                    )}
                    {/* User is in UK (GBP) - show info message */}
                    {localCurrency === 'gbp' && (
                      <p className="text-gray-600 text-sm">
                        Payment will be processed in British Pounds (GBP)
                      </p>
                    )}
                    {/* No currency detected - prompt user to set country */}
                    {!localCurrency && (
                      <div className="flex items-center gap-2 text-amber-700">
                        <Link href="/settings" className="underline hover:text-amber-800 text-sm font-medium">
                          Set your country to see converted amounts
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor={descriptionId} className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  id={descriptionId}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="What is this payment for?"
                  maxLength={500}
                />
              </div>

              <button
                type="submit"
                disabled={creating || amount <= 0}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {creating ? 'Processing...' : 'Continue to Payment'}
              </button>
            </form>
          )}

          {/* Step 2: CurrencySelectorElement + PaymentElement inside Elements context */}
          {clientSecret && (
            <StripeProvider stripe={getStripe()} options={{ clientSecret }}>
              <PaymentForm
                amount={amount}
                description={description}
                paymentIntentId={paymentIntentId}
                onSuccess={() => window.location.assign('/payments')}
                onCancel={handleCancel}
                localCurrency={localCurrency}
                convertedAmount={converted?.converted}
                idempotencyKey={idempotencyKey}
              />
            </StripeProvider>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Your payment is secured by Stripe encryption</p>
          <p className="text-xs text-gray-400 mt-1">
            Retry protection enabled via idempotency key
          </p>
        </div>
      </main>
    </div>
  );
}
