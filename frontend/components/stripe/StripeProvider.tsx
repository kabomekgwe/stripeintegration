'use client';

import { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { Stripe, StripeElementsOptions } from '@stripe/stripe-js';

interface StripeProviderProps {
  stripe: Promise<Stripe | null>;
  options?: StripeElementsOptions;
  children: React.ReactNode;
}

export function StripeProvider({ stripe, options, children }: StripeProviderProps) {
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    stripe
      .then((instance) => {
        if (!instance) {
          setError(new Error('Stripe failed to load. Check your publishable key.'));
          return;
        }
        setStripeInstance(instance);
      })
      .catch((err) => {
        console.error('Failed to load Stripe.js:', err);
        setError(err);
      });
  }, [stripe]);

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-700">
        <p className="font-medium">Failed to initialize payment form</p>
        <p className="text-sm mt-1">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-sm underline hover:no-underline"
        >
          Refresh page
        </button>
      </div>
    );
  }

  if (!stripeInstance) {
    return (
      <div className="animate-pulse flex flex-col space-y-4">
        <div className="h-12 bg-gray-200 rounded" />
        <div className="h-24 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-100 rounded w-1/2" />
      </div>
    );
  }

  return (
    <Elements stripe={Promise.resolve(stripeInstance)} options={options}>
      {children}
    </Elements>
  );
}
