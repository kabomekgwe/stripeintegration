import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = (): Promise<Stripe | null> => {
  // Return cached promise if available
  if (stripePromise) {
    return stripePromise;
  }

  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!key) {
    console.error('❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined');
    // Return a rejected promise that will be handled by the caller
    return Promise.reject(new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined. Please add it to your environment variables.'));
  }

  // Validate key format (should be pk_test_ or pk_live_)
  if (!key.startsWith('pk_test_') && !key.startsWith('pk_live_')) {
    console.error('❌ Invalid Stripe publishable key format:', key.substring(0, 20) + '...');
    return Promise.reject(new Error('Invalid Stripe publishable key format. Key must start with pk_test_ or pk_live_'));
  }

  // Cache the promise for the lifetime of the application
  stripePromise = loadStripe(key);

  stripePromise.catch((err) => {
    console.error('❌ Failed to load Stripe.js:', err);
    // Reset promise on failure so next call can retry
    stripePromise = null;
  });

  return stripePromise;
};

// Utility to check if Stripe is properly configured
export const isStripeConfigured = (): boolean => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return !!key && (key.startsWith('pk_test_') || key.startsWith('pk_live_'));
};
