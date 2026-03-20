'use client';

import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface LoginFormProps {
  onSubmit: (credentials: { email: string; password: string }) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
}

export function LoginForm({ onSubmit, isLoading = false, error }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form" noValidate>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (validationErrors.email) {
              setValidationErrors((prev) => ({ ...prev, email: undefined }));
            }
          }}
          className="mt-1"
          aria-describedby={validationErrors.email ? 'email-error' : undefined}
          disabled={isLoading}
          data-testid="email-input"
        />
        {validationErrors.email && (
          <p id="email-error" className="text-sm text-red-600 mt-1" data-testid="email-error">
            {validationErrors.email}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (validationErrors.password) {
              setValidationErrors((prev) => ({ ...prev, password: undefined }));
            }
          }}
          className="mt-1"
          aria-describedby={validationErrors.password ? 'password-error' : undefined}
          disabled={isLoading}
          data-testid="password-input"
        />
        {validationErrors.password && (
          <p id="password-error" className="text-sm text-red-600 mt-1" data-testid="password-error">
            {validationErrors.password}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" data-testid="login-error">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        data-testid="submit-button"
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}