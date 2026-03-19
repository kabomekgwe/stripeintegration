'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRequestPasswordResetMutation } from '@/store/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [resetPassword, { isLoading, error }] = useRequestPasswordResetMutation();
  const hasError = !!(error && typeof error === 'object' && error !== null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await resetPassword({ email }).unwrap();
      setSubmitted(true);
    } catch (err) {
      // Error handled by RTK Query - still show success to prevent email enumeration
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-lg bg-card p-8 shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
          <p className="mt-2 text-muted-foreground">
            If an account exists with that email, we&apos;ve sent a password reset link.
          </p>
        </div>
        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-card p-8 shadow-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
        <p className="mt-2 text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
            placeholder="you@example.com"
          />
        </div>

        {hasError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Something went wrong. Please try again.
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Remember your password?{' '}
        <Link href="/auth/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
