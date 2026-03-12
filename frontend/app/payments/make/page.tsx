'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { PaymentElementForm } from '@/components/stripe/PaymentElementForm';
import { useCreatePaymentIntentMutation, useGetPaymentMethodsQuery } from '@/store/api';
import { Navbar } from '@/components/Navbar';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export default function MakePaymentPage() {
  const router = useRouter();
  const [createIntent, { isLoading: isCreating }] = useCreatePaymentIntentMutation();
  const { data: paymentMethodsData } = useGetPaymentMethodsQuery();

  const paymentMethods = paymentMethodsData?.paymentMethods || [];

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'payment'>('form');

  const defaultPaymentMethod = paymentMethods.find((pm) => pm.isDefault);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountCents = Math.round(parseFloat(amount) * 100);

    try {
      const result = await createIntent({
        amount: amountCents,
        currency: 'usd',
        paymentMethodId: selectedPaymentMethod || undefined,
        description: description || undefined,
      }).unwrap();

      setClientSecret(result.clientSecret);
      setPaymentIntentId(result.paymentIntentId);
      setStep('payment');
    } catch (error) {
      alert('Failed to create payment. Please try again.');
    }
  };

  const handleSuccess = () => {
    router.push('/payments');
  };

  const handleCancel = () => {
    setStep('form');
    setClientSecret(null);
    setPaymentIntentId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Make a Payment</h1>

        {step === 'form' ? (
          <form onSubmit={handleSubmitForm} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Amount (USD)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  min="0.50"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="block w-full rounded-md border border-gray-300 py-2 pl-7 pr-3 focus:border-blue-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="What is this payment for?"
              />
            </div>

            {paymentMethods.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Payment Method
                </label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">
                    Use default ({defaultPaymentMethod?.brand} ****{' '}
                    {defaultPaymentMethod?.last4})
                  </option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.brand?.toUpperCase()} **** {pm.last4}
                      {pm.isDefault ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isCreating || !amount}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreating ? 'Initializing...' : 'Continue to Payment'}
            </button>
          </form>
        ) : clientSecret && paymentIntentId ? (
          <div className="mt-8">
            <div className="mb-4 rounded-md bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Paying: <strong>${parseFloat(amount).toFixed(2)}</strong>
              </p>
            </div>
            <StripeProvider
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <PaymentElementForm
                clientSecret={clientSecret}
                paymentIntentId={paymentIntentId}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </StripeProvider>
          </div>
        ) : null}
      </main>
    </div>
  );
}
