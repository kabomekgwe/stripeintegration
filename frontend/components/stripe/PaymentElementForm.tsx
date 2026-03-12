'use client';

import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useConfirmPaymentMutation } from '@/store/api';

interface PaymentElementFormProps {
  clientSecret: string;
  paymentIntentId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentElementForm({
  clientSecret,
  paymentIntentId,
  onSuccess,
  onCancel,
}: PaymentElementFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirmPayment, { isLoading: isConfirming }] = useConfirmPaymentMutation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
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

    if (paymentIntent.status === 'succeeded') {
      await confirmPayment(paymentIntentId);
      onSuccess();
    } else if (paymentIntent.status === 'requires_action') {
      setError('Additional authentication required. Please check your email.');
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          disabled={isLoading || isConfirming}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isLoading || isConfirming}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading || isConfirming ? 'Processing...' : 'Pay now'}
        </button>
      </div>
    </form>
  );
}
