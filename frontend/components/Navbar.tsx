'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useLogoutMutation, useGetMeQuery, useGetCurrenciesQuery, useUpdatePreferredCurrencyMutation } from '@/store/api';
import { clearCredentials } from '@/store/authSlice';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';

const currencyFlags: Record<string, string> = {
  usd: '🇺🇸',
  eur: '🇪🇺',
  gbp: '🇬🇧',
  cad: '🇨🇦',
  aud: '🇦🇺',
  jpy: '🇯🇵',
};

export function Navbar() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { data: user } = useGetMeQuery();
  const { data: currenciesData } = useGetCurrenciesQuery();
  const [updateCurrency] = useUpdatePreferredCurrencyMutation();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currencies = currenciesData?.currencies || [];
  const currentCurrency = user?.preferredCurrency || 'usd';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCurrencyChange = async (currency: string) => {
    try {
      await updateCurrency(currency).unwrap();
    } catch (error) {
      console.error('Failed to update currency:', error);
    }
    setShowCurrencyDropdown(false);
  };

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } finally {
      dispatch(clearCredentials());
      router.push('/auth/login');
    }
  };

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold">
              Stripe Payments
            </Link>
            <div className="hidden gap-4 md:flex">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/subscriptions"
                className="text-gray-600 hover:text-gray-900"
              >
                Subscriptions
              </Link>
              <Link
                href="/payment-methods"
                className="text-gray-600 hover:text-gray-900"
              >
                Payment Methods
              </Link>
              <Link
                href="/payments"
                className="text-gray-600 hover:text-gray-900"
              >
                Payments
              </Link>
              <Link href="/usage" className="text-gray-600 hover:text-gray-900">
                Usage
              </Link>
              <Link href="/disputes" className="text-gray-600 hover:text-gray-900">
                Disputes
              </Link>
              <Link href="/connect" className="text-gray-600 hover:text-gray-900">
                Seller
              </Link>
              <Link
                href="/settings"
                className="text-gray-600 hover:text-gray-900"
              >
                Settings
              </Link>
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Currency Switcher */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  title="Click to change currency"
                >
                  <span className="text-lg">{currencyFlags[currentCurrency] || '💰'}</span>
                  <span className="uppercase">{currentCurrency}</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCurrencyDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                      Select Currency
                    </div>
                    {currencies.map((currency: any) => (
                      <button
                        key={currency.code}
                        onClick={() => handleCurrencyChange(currency.code.toLowerCase())}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                          currentCurrency === currency.code.toLowerCase() ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-lg">{currencyFlags[currency.code.toLowerCase()] || '💰'}</span>
                        <span className="font-medium">{currency.code}</span>
                        <span className="text-gray-400 text-xs">- {currency.name}</span>
                      </button>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <Link
                        href="/settings"
                        onClick={() => setShowCurrencyDropdown(false)}
                        className="block px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      >
                        Manage in Settings →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {isLoggingOut ? '...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
