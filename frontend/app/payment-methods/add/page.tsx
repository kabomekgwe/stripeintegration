'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { SetupIntentForm } from '@/components/stripe/SetupIntentForm';
import { useCreateSetupIntentMutation } from '@/store/api';
import { Navbar } from '@/components/Navbar';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export default function AddPaymentMethodPage() {
  const router = useRouter();
  const [createSetupIntent, { isLoading: isCreatingSetupIntent }] = useCreateSetupIntentMutation();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSetupIntent = async () => {
      try {
        const result = await createSetupIntent().unwrap();
        setClientSecret(result.clientSecret);
      } catch (err) {
        setError('Failed to initialize payment form');
      }
    };

    initSetupIntent();
  }, [createSetupIntent]);

  const handleSuccess = () => {
    router.push('/payment-methods');
  };

  const handleCancel = () => {
    router.push('/payment-methods');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Add Payment Method</h1>
        <p className="mt-2 text-gray-600">
          Enter your card details below. This card will be saved for future
          payments.
        </p>

        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          {isCreatingSetupIntent ? (
            <div className="py-12 text-center">Loading payment form...</div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>
          ) : clientSecret ? (
            <StripeProvider
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                },
              }}
            >
              <SetupIntentForm
                clientSecret={clientSecret}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </StripeProvider>
          ) : null}
        </div>
      </main>
    </div>
  );
}
