'use client';

import { useState, useId } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useConfirmPaymentMutation } from '@/store/api';

interface PaymentFormProps {
  amount: number;
  description: string;
  paymentIntentId: string;
  onSuccess: () => void;
  onCancel: () => void;
  localCurrency?: string;
  convertedAmount?: { amount: number; currency: string; formatted: string };
  idempotencyKey: string;
}

export function PaymentForm({
  amount,
  description,
  paymentIntentId,
  onSuccess,
  onCancel,
  localCurrency,
  convertedAmount,
  idempotencyKey,
}: PaymentFormProps) {
  const amountId = useId();
  const descriptionId = useId();
  const stripe = useStripe();
  const elements = useElements();
  const [confirmPayment] = useConfirmPaymentMutation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'An error occurred');
      setIsLoading(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      await confirmPayment(paymentIntentId);
      onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="payment-form">
      {/* Idempotency key indicator */}
      <div className="text-xs text-gray-400 mb-4" data-testid="idempotency-key">
        Idempotency key: {idempotencyKey}
      </div>

      {/* Step 1 fields — read-only summary */}
      <div>
        <label htmlFor={amountId} className="block text-sm font-medium text-gray-700 mb-2">
          Amount (£)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
          <input
            id={amountId}
            type="text"
            readOnly
            value={amount.toFixed(2)}
            className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
            data-testid="amount-input"
          />
        </div>
        {/* Show converted amount in user's currency */}
        {localCurrency && localCurrency !== 'gbp' && convertedAmount && (
          <p className="text-sm text-blue-600 font-medium mt-2" data-testid="converted-amount">
            ≈ {convertedAmount.formatted} {convertedAmount.currency.toUpperCase()}
          </p>
        )}
      </div>

      {description && (
        <div>
          <label htmlFor={descriptionId} className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <input
            id={descriptionId}
            type="text"
            readOnly
            value={description}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
            data-testid="description-input"
          />
        </div>
      )}

      <PaymentElement />

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" data-testid="payment-error">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          data-testid="cancel-button"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isLoading}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          data-testid="submit-button"
        >
          {isLoading ? 'Processing...' : 'Pay now'}
        </button>
      </div>
    </form>
  );
}