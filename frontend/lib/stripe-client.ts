import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!key) {
      console.error('❌ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined');
      return Promise.reject(new Error('Stripe publishable key not found'));
    }

    // Validate key format (should be pk_test_ or pk_live_)
    if (!key.startsWith('pk_test_') && !key.startsWith('pk_live_')) {
      console.error('❌ Invalid Stripe publishable key format:', key.substring(0, 20) + '...');
      return Promise.reject(new Error('Invalid Stripe publishable key format'));
    }

    console.log('✅ Loading Stripe.js with key:', key.substring(0, 20) + '...');
    stripePromise = loadStripe(key);

    stripePromise.catch((err) => {
      console.error('❌ Failed to load Stripe.js:', err);
    });
  }
  return stripePromise;
};
