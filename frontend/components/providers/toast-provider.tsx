'use client';

import { Toaster } from '@/components/ui/sonner';

/**
 * ToastProvider - Provides toast notification functionality via Sonner
 *
 * This provider enables toast notifications throughout the app using the `toast()` function from sonner.
 *
 * Usage examples:
 * ```tsx
 * import { toast } from 'sonner';
 *
 * // Success notification
 * toast.success('Payment successful', { description: '$99.00 has been charged.' });
 *
 * // Error notification
 * toast.error('Payment failed', { description: 'Please check your card details.' });
 *
 * // Info notification
 * toast.info('Subscription cancelled', { description: 'Your subscription will end on Jan 15.' });
 *
 * // Warning notification
 * toast.warning('Card expiring soon', { description: 'Your card expires next month.' });
 * ```
 */
export function ToastProvider() {
  return <Toaster position="bottom-right" richColors closeButton />;
}