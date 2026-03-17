'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SetupIntentForm } from '@/components/stripe/SetupIntentForm';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { getStripe, isStripeConfigured } from '@/lib/stripe-client';
import { useCreateSetupIntentMutation } from '@/store/api';
import Link from 'next/link';

export default function AddPaymentMethodPage() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [createSetupIntent, { isLoading: creatingIntent, error }] = useCreateSetupIntentMutation();
  const [setupComplete, setSetupComplete] = useState(false);
  const [stripeConfigError, setStripeConfigError] = useState<string | null>(null);

  // Check Stripe configuration on mount
  useEffect(() => {
    if (!isStripeConfigured()) {
      setStripeConfigError('Stripe is not properly configured. Please check your environment variables.');
      return;
    }
  }, []);

  // Auto-create setup intent when page loads
  useEffect(() => {
    if (stripeConfigError) return; // Don't create intent if config is broken

    createSetupIntent()
      .unwrap()
      .then(result => setClientSecret(result.clientSecret))
      .catch(err => console.error('Failed to create setup intent:', err));
  }, [createSetupIntent, stripeConfigError]);

  const handleSetupSuccess = () => {
    setSetupComplete(true);
    // Redirect after a short delay
    setTimeout(() => {
      router.push('/payment-methods');
    }, 2000);
  };

  const handleCancel = () => {
    router.push('/payment-methods');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/payment-methods"
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Payment Methods
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Add Payment Method</h1>
        <p className="text-gray-600 mb-8">
          Add a new payment method to your account. Your payment information is securely handled by Stripe.
        </p>

        {stripeConfigError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {stripeConfigError}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            Failed to initialize payment form.{' '}
            <button
              onClick={() => window.location.reload()}
              className="underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {creatingIntent && !clientSecret ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">Preparing Secure Payment Form...</h2>
            <p className="text-gray-600">Please wait while we set up the payment form.</p>
          </div>
        ) : setupComplete ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-800 mb-2">Payment Method Added!</h2>
            <p className="text-gray-600 mb-4">
              Your payment method has been saved successfully. Redirecting you back...
            </p>
            <Link
              href="/payment-methods"
              className="text-blue-600 hover:underline"
            >
              Go to Payment Methods now →
            </Link>
          </div>
        ) : clientSecret ? (
          <StripeProvider
            stripe={getStripe()}
            options={{ clientSecret }}
          >
            <div className="bg-white rounded-lg shadow p-6">
              <SetupIntentForm
                clientSecret={clientSecret}
                onSuccess={handleSetupSuccess}
                onCancel={handleCancel}
              />
            </div>
          </StripeProvider>
        ) : null}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            🔒 Your payment information is processed securely by Stripe.
            We never store your full payment details.
          </p>
        </div>
      </main>
    </div>
  );
}
