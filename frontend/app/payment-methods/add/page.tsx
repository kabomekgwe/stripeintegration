'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SetupIntentForm } from '@/components/stripe/SetupIntentForm';
import { useCreateSetupIntentMutation } from '@/store/api';
import Link from 'next/link';

export default function AddPaymentMethodPage() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [createSetupIntent, { isLoading: creatingIntent, error }] = useCreateSetupIntentMutation();
  const [setupComplete, setSetupComplete] = useState(false);

  const handleStartSetup = async () => {
    try {
      const result = await createSetupIntent().unwrap();
      setClientSecret(result.clientSecret);
    } catch (err) {
      console.error('Failed to create setup intent:', err);
    }
  };

  const handleSetupSuccess = () => {
    setSetupComplete(true);
    // Redirect after a short delay
    setTimeout(() => {
      router.push('/payment-methods');
    }, 2000);
  };

  const handleCancel = () => {
    setClientSecret(null);
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
          Add a new payment method to your account. Your card information is securely handled by Stripe.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            Failed to initialize payment form. Please try again.
          </div>
        )}

        {!clientSecret ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Secure Card Setup</h2>
              <p className="text-gray-600">
                We'll collect your card details securely. You won't be charged now.
              </p>
            </div>

            <button
              onClick={handleStartSetup}
              disabled={creatingIntent}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingIntent ? 'Preparing...' : 'Enter Card Details'}
            </button>
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
              Your card has been saved successfully. Redirecting you back...
            </p>
            <Link
              href="/payment-methods"
              className="text-blue-600 hover:underline"
            >
              Go to Payment Methods now →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <SetupIntentForm
              clientSecret={clientSecret}
              onSuccess={handleSetupSuccess}
              onCancel={handleCancel}
            />
          </div>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            🔒 Your payment information is processed securely by Stripe.
            We never store your full card details.
          </p>
        </div>
      </main>
    </div>
  );
}
