'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { PaymentElementForm } from '@/components/stripe/PaymentElementForm';
import { useCreatePaymentIntentMutation, useGetPaymentMethodsQuery } from '@/store/api';

export default function MakePaymentPage() {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [currency, setCurrency] = useState<string>('usd');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [paymentCreated, setPaymentCreated] = useState(false);
  
  const { data: paymentMethodsData } = useGetPaymentMethodsQuery();
  const [createPaymentIntent, { isLoading: creating, error: createError }] = useCreatePaymentIntentMutation();

  const hasPaymentMethods = (paymentMethodsData?.paymentMethods?.length || 0) > 0;

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
                  <span className="font-medium">${amount.toFixed(2)} {currency.toUpperCase()}</span>
                </div>
                {description && (
                  <div className="flex justify-between">
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
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
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
              <p className="text-sm text-gray-500 mt-1">Minimum: $0.50</p>
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="usd">USD - US Dollar</option>
                <option value="eur">EUR - Euro</option>
                <option value="gbp">GBP - British Pound</option>
              </select>
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
                  {amount > 0 ? `$${amount.toFixed(2)}` : '-'} {currency.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Tax</span>
                <span className="text-gray-500">Calculated at checkout</span>
              </div>
              <hr className="my-2 border-gray-200" />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>
                  {amount > 0 ? `$${amount.toFixed(2)}` : '-'} {currency.toUpperCase()}
                </span>
              </div>
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
        </div>
      </main>
    </div>
  );
}
