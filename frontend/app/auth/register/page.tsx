'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRegisterMutation } from '@/store/api';
import { setCredentials } from '@/store/authSlice';
import { useDispatch } from 'react-redux';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COUNTRIES } from '@/lib/countries';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const router = useRouter();
  const dispatch = useDispatch();

  const [register, { isLoading, error }] = useRegisterMutation();
  const hasError = !!(error && typeof error === 'object' && error !== null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await register({
        email,
        password,
        name: name || undefined,
        country: country || undefined,
      }).unwrap();
      dispatch(setCredentials(result));
      router.push('/dashboard');
    } catch (err) {
      // Error handled by RTK Query
    }
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Create account</h1>
        <p className="mt-2 text-muted-foreground">Get started with Stripe Payments</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">Name (optional)</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="country">Country (Optional)</Label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select your country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground mt-1">
            We'll suggest the best currency for your region
          </p>
        </div>

        {hasError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {'data' in error && typeof error.data === 'object'
              ? (error.data as { message?: string })?.message || 'Registration failed'
              : 'An error occurred'}
          </div>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}