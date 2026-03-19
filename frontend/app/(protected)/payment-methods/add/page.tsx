'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SetupIntentForm } from '@/components/stripe/SetupIntentForm';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { getStripe, isStripeConfigured } from '@/lib/stripe-client';
import { useCreateSetupIntentMutation } from '@/store/api';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CreditCardIcon, 
  CheckIcon,
  ArrowLeftIcon,
} from 'lucide-react';

export default function AddPaymentMethodPage() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [stripeConfigError, setStripeConfigError] = useState<string | null>(null);

  const [createSetupIntent, { isLoading: creatingIntent, error }] = useCreateSetupIntentMutation();

  useEffect(() => {
    if (!isStripeConfigured()) {
      setStripeConfigError('Stripe is not properly configured. Please check your environment variables.');
    }
  }, []);

  useEffect(() => {
    if (!clientSecret && !stripeConfigError && !creatingIntent) {
      createSetupIntent()
        .unwrap()
        .then(result => setClientSecret(result.clientSecret))
        .catch(err => console.error('Failed to create setup intent:', err));
    }
  }, [clientSecret, stripeConfigError, creatingIntent, createSetupIntent]);

  const handleSetupSuccess = (error?: { duplicate?: boolean; message?: string }) => {
    if (error?.duplicate) {
      setIsDuplicate(true);
      setSetupError(error.message || 'This payment method is already saved to your account.');
    } else if (error?.message) {
      setSetupError(error.message);
    } else {
      setSetupComplete(true);
      setTimeout(() => router.push('/payment-methods'), 2000);
    }
  };

  const handleCancel = () => {
    router.push('/payment-methods');
  };

  // Loading state
  if (creatingIntent || (!clientSecret && !stripeConfigError)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6">
            <Link
              href="/payment-methods"
              className="text-blue-600 hover:underline text-sm flex items-center gap-1"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Payment Methods
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <CreditCardIcon className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              Preparing Secure Payment Form...
            </h2>
            <p className="text-gray-600">Please wait while we set up the payment form.</p>
          </div>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="text-blue-600 hover:underline text-sm flex items-center gap-1"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Payment Methods
          </button>
        </div>

        <h1 className="text-3xl font-bold mb-2">Add Payment Method</h1>
        <p className="text-gray-600 mb-8">
          Your payment information is securely handled by Stripe.
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

        {/* Success State */}
        {setupComplete ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-green-800 mb-2">
              Payment Method Added!
            </h2>
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
        ) : (isDuplicate || setupError) ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCardIcon className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-amber-800 mb-2">
              {isDuplicate ? 'Payment Method Already Saved' : 'Unable to Add Payment Method'}
            </h2>
            <p className="text-gray-600 mb-4">
              {setupError}
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/payment-methods">
                <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                  Go to Payment Methods
                </button>
              </Link>
              <button 
                onClick={() => {
                  setSetupError(null);
                  setIsDuplicate(false);
                  setClientSecret(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : clientSecret && (
          <StripeProvider
            stripe={getStripe()}
            options={{ clientSecret }}
          >
            <Card>
              <CardContent className="p-6">
                <SetupIntentForm
                  clientSecret={clientSecret}
                  onSuccess={handleSetupSuccess}
                  onCancel={handleCancel}
                />
              </CardContent>
            </Card>
          </StripeProvider>
        )}

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
