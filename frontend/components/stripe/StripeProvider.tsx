'use client';

import { Elements } from '@stripe/react-stripe-js';
import { Stripe, StripeElementsOptions } from '@stripe/stripe-js';

interface StripeProviderProps {
  stripe: Promise<Stripe | null>;
  options?: StripeElementsOptions;
  children: React.ReactNode;
}

export function StripeProvider({ stripe, options, children }: StripeProviderProps) {
  return (
    <Elements stripe={stripe} options={options}>
      {children}
    </Elements>
  );
}
