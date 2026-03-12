'use client';

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
  ExpressCheckoutElement,
} from '@stripe/react-stripe-js';
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
      {/* Express Checkout: Apple Pay, Google Pay, Link */}
      <ExpressCheckoutElement
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

      <PaymentElement />

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
