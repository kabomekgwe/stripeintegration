'use client';

import { Elements } from '@stripe/react-stripe-js';
import { Stripe, StripeElementsOptions } from '@stripe/stripe-js';

interface StripeProviderProps {
  stripe: Promise<Stripe | null>;
  options?: StripeElementsOptions;
  children: React.ReactNode;
}

export function StripeProvider({ stripe, options, children }: StripeProviderProps) {
  // Elements component handles the promise resolution internally
  // We just need to pass the promise directly (not create a new one)
  // and provide a loading state while Elements initializes

  // Add appearance config for better UX
  const elementsOptions: StripeElementsOptions = {
    ...options,
    appearance: {
      theme: 'stripe',
      variables: {
        fontFamily: 'system-ui, sans-serif',
        fontSizeBase: '16px',
      },
      
    },

    currency: (options as { clientSecret?: string; currency?: string })?.currency ?? undefined,
  };

  return (
    <Elements stripe={stripe} options={elementsOptions}>
      {children}
    </Elements>
  );
}
