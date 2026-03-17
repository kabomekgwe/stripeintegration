'use client';

import { useEffect, useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
  ExpressCheckoutElement,
} from '@stripe/react-stripe-js';
import { StripeError } from '@stripe/stripe-js';
import { useSavePaymentMethodMutation } from '@/store/api';

interface SetupIntentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SetupIntentForm({
  clientSecret,
  onSuccess,
  onCancel,
}: SetupIntentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [savePaymentMethod, { isLoading: isSaving }] = useSavePaymentMethodMutation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expressCheckoutAvailable, setExpressCheckoutAvailable] = useState(true);

  // ExpressCheckoutElement (Apple Pay/Google Pay) is optional and may not be available
  // on all browsers. Handle its failure gracefully.
  const handleExpressCheckoutError = (error: StripeError) => {
    // Log for debugging but don't show to user - this is often expected
    console.warn('Express checkout not available:', error.message || 'Browser does not support Apple Pay/Google Pay');
    setExpressCheckoutAvailable(false);
  };

  // PaymentElement errors are critical - show to user
  const handlePaymentElementError = (error: StripeError) => {
    // Stripe sometimes returns empty error objects when JS fails to load
    // Provide a more helpful error message
    const errorMessage = error.message ||
      (Object.keys(error).length === 0
        ? 'Stripe.js failed to load. Please check your internet connection, disable any ad blockers, and refresh the page.'
        : 'Unknown error loading payment form');

    console.error('Payment element load error:', {
      message: error.message,
      code: error.code,
      type: error.type,
      hasKeys: Object.keys(error).length > 0
    });

    setError(`Failed to load payment form: ${errorMessage}`);
  };

  // Debug: Log when component mounts to verify Stripe is loaded
  useEffect(() => {
    console.log('SetupIntentForm mounted', {
      hasStripe: !!stripe,
      hasElements: !!elements,
      clientSecretLength: clientSecret?.length,
      clientSecretPrefix: clientSecret?.substring(0, 10)
    });
  }, [stripe, elements, clientSecret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: submitError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'An error occurred');
      setIsLoading(false);
      return;
    }

    if (setupIntent.status === 'succeeded') {
      // Save to our backend
      await savePaymentMethod(setupIntent.payment_method as string);
      onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Express Checkout: Apple Pay, Google Pay, Link (optional - may not be available on all browsers) */}
      {expressCheckoutAvailable && (
        <>
          <ExpressCheckoutElement
            onLoadError={handleExpressCheckoutError}
            onConfirm={async () => {
              if (!stripe || !elements) return;

              setIsLoading(true);
              const { error: submitError } = await stripe.confirmSetup({
                elements,
                confirmParams: {
                  return_url: window.location.href,
                },
                redirect: 'if_required',
              });

              if (submitError) {
                setError(submitError.message || 'An error occurred');
                setIsLoading(false);
                return;
              }

              onSuccess();
              setIsLoading(false);
            }}
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Or add card manually</span>
            </div>
          </div>
        </>
      )}

      <PaymentElement onLoadError={handlePaymentElementError} />

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading || isSaving}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isLoading || isSaving}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading || isSaving ? 'Saving...' : 'Save card'}
        </button>
      </div>
    </form>
  );
}
