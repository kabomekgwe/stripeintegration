'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { PaymentElementForm } from '@/components/stripe/PaymentElementForm';
import { 
  useCreatePaymentIntentMutation, 
  useGetPaymentMethodsQuery, 
  useGetMeQuery, 
  useGetCurrenciesQuery,
  useDetectCurrencyQuery,
  useConvertCurrencyQuery,
  useUpdatePreferredCurrencyMutation,
} from '@/store/api';

const currencySymbols: Record<string, string> = {
  usd: '$',
  eur: '€',
  gbp: '£',
  cad: 'C$',
  aud: 'A$',
  jpy: '¥',
};

const currencyFlags: Record<string, string> = {
  usd: '🇺🇸',
  eur: '🇪🇺',
  gbp: '🇬🇧',
  cad: '🇨🇦',
  aud: '🇦🇺',
  jpy: '🇯🇵',
};

export default function MakePaymentPage() {
  const router = useRouter();
  const { data: user } = useGetMeQuery();
  const { data: currenciesData } = useGetCurrenciesQuery();
  const [updateCurrency] = useUpdatePreferredCurrencyMutation();
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [currency, setCurrency] = useState<string>('usd');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [paymentCreated, setPaymentCreated] = useState(false);
  const [detectedCurrency, setDetectedCurrency] = useState<string | null>(null);
  const [showDetectionNotice, setShowDetectionNotice] = useState(false);
  
  const { data: paymentMethodsData } = useGetPaymentMethodsQuery();
  const [createPaymentIntent, { isLoading: creating, error: createError }] = useCreatePaymentIntentMutation();

  // Get conversion for USD equivalent display
  const { data: conversionData } = useConvertCurrencyQuery(
    { amount: Math.round(amount * 100), from: currency, to: 'usd' },
    { skip: amount <= 0 || currency === 'usd' }
  );

  // Detect currency from IP (only when no user preference)
  const { data: detectedCurrencyData } = useDetectCurrencyQuery(undefined, {
    skip: !!user?.preferredCurrency || !!detectedCurrency,
  });

  // Set currency from user preference when available
  useEffect(() => {
    if (user?.preferredCurrency) {
      setCurrency(user.preferredCurrency);
    }
  }, [user]);

  // Handle detected currency from RTK Query
  useEffect(() => {
    if (detectedCurrencyData?.suggestedCurrency && detectedCurrencyData.suggestedCurrency !== 'USD') {
      const detected = detectedCurrencyData.suggestedCurrency.toLowerCase();
      setDetectedCurrency(detected);
      setCurrency(detected);
      setShowDetectionNotice(true);
      // Auto-save detected currency as preference
      updateCurrency(detected);
    }
  }, [detectedCurrencyData, updateCurrency]);

  const hasPaymentMethods = (paymentMethodsData?.paymentMethods?.length || 0) > 0;
  const currencies = currenciesData?.currencies || [];
  const currencySymbol = currencySymbols[currency] || '$';
  const usdEquivalent = conversionData?.converted?.amount 
    ? (conversionData.converted.amount / 100).toFixed(2)
    : null;

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    try {
      const result = await createPaymentIntent({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        description: description || 'Payment',
      }).unwrap();
      
      setClientSecret(result.clientSecret);
      setPaymentIntentId(result.paymentIntentId);
      setPaymentCreated(true);
    } catch (err) {
      console.error('Failed to create payment:', err);
    }
  };

  const handlePaymentSuccess = () => {
    router.push('/payments');
  };

  const handleCancel = () => {
    setClientSecret(null);
    setPaymentCreated(false);
  };

  const handleDismissDetection = () => {
    setShowDetectionNotice(false);
  };

  // Show payment form if clientSecret exists
  if (clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-xl px-4 py-8">
          <div className="mb-6">
            <button
              onClick={() => {
                setClientSecret(null);
                setPaymentCreated(false);
              }}
              className="text-blue-600 hover:underline text-sm"
            >
              ← Back to Payment Details
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold mb-4">Payment Summary</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Amount</span>
                  <span className="font-medium">{currencySymbol}{amount.toFixed(2)} {currency.toUpperCase()}</span>
                </div>
                {usdEquivalent && currency !== 'usd' && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>≈ USD Equivalent</span>
                    <span>${usdEquivalent}</span>
                  </div>
                )}
                {description && (
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-600">Description</span>
                    <span className="font-medium text-right max-w-[60%]">{description}</span>
                  </div>
                )}
              </div>
            </div>

            <PaymentElementForm
              clientSecret={clientSecret}
              paymentIntentId={paymentIntentId}
              onSuccess={handlePaymentSuccess}
              onCancel={handleCancel}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/payments"
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Payments
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Make a Payment</h1>
        <p className="text-gray-600 mb-8">
          Enter the payment details below to process a one-time charge.
        </p>

        {/* Currency Detection Notice */}
        {showDetectionNotice && detectedCurrency && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌍</span>
              <span>
                We've detected you're in a region that uses {detectedCurrency.toUpperCase()}. 
                Currency set to {currencyFlags[detectedCurrency]} {detectedCurrency.toUpperCase()}.
              </span>
            </div>
            <button 
              onClick={handleDismissDetection}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Dismiss
            </button>
          </div>
        )}

        {!hasPaymentMethods && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
            <p className="text-sm">
              You don't have any saved payment methods. Consider adding one first for faster checkout.
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
            Failed to initialize payment. Please try again.
          </div>
        )}

        <form onSubmit={handleCreatePayment} className="bg-white rounded-lg shadow p-6">
          <div className="space-y-6">
            {/* Currency Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <div className="grid grid-cols-3 gap-2">
                {currencies.map((curr: any) => (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => setCurrency(curr.code.toLowerCase())}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      currency === curr.code.toLowerCase()
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg mr-1">{currencyFlags[curr.code.toLowerCase()] || '💰'}</span>
                    <span className="font-medium">{curr.code}</span>
                  </button>
                ))}
              </div>
              {user?.preferredCurrency && (
                <p className="text-sm text-gray-500 mt-2">
                  Using your preferred currency: {currency.toUpperCase()}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencySymbol}</span>
                <input
                  type="number"
                  id="amount"
                  step="0.01"
                  min="0.50"
                  required
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">Minimum: {currencySymbol}0.50</p>
              
              {/* USD Equivalent Display */}
              {amount > 0 && currency !== 'usd' && usdEquivalent && (
                <p className="text-sm text-blue-600 mt-1">
                  ≈ ${usdEquivalent} USD
                </p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="What is this payment for?"
                maxLength={500}
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>
                  {amount > 0 ? `${currencySymbol}${amount.toFixed(2)}` : '-'} {currency.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Tax</span>
                <span className="text-gray-500">Calculated at checkout</span>
              </div>
              
              {/* USD Equivalent in Summary */}
              {amount > 0 && currency !== 'usd' && usdEquivalent && (
                <div className="flex justify-between text-sm mt-1 text-blue-600">
                  <span>≈ USD Equivalent</span>
                  <span>${usdEquivalent}</span>
                </div>
              )}
              
              <hr className="my-2 border-gray-200" />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>
                  {amount > 0 ? `${currencySymbol}${amount.toFixed(2)}` : '-'} {currency.toUpperCase()}
                </span>
              </div>
              
              {/* USD Total Equivalent */}
              {amount > 0 && currency !== 'usd' && usdEquivalent && (
                <div className="flex justify-between text-sm text-blue-600 mt-1">
                  <span>≈</span>
                  <span>${usdEquivalent} USD</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={creating || amount <= 0}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Processing...' : 'Continue to Payment'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>🔒 Your payment is secured by Stripe encryption</p>
          {currency !== 'usd' && (
            <p className="mt-1 text-xs">
              Exchange rates are approximate and updated daily
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
