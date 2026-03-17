'use client';

import Link from 'next/link';
import { useLogoutMutation, useGetMeQuery, useGetCurrenciesQuery, useUpdatePreferredCurrencyMutation } from '@/store/api';
import { clearCredentials } from '@/store/authSlice';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { UserIcon, SignOutIcon, GlobeIcon } from '@phosphor-icons/react';

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

  const currencies = currenciesData?.currencies || [];
  const currentCurrency = user?.preferredCurrency || 'usd';

  const handleCurrencyChange = async (currency: string) => {
    try {
      await updateCurrency(currency).unwrap();
    } catch (error) {
      console.error('Failed to update currency:', error);
    }
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
    <nav className="border-b bg-card" role="navigation" aria-label="Main navigation">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Stripe Payments
          </Link>

          {/* User Actions */}
          <div className="flex items-center gap-2">
            {/* Currency Switcher */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    aria-label={`Select currency, current: ${currentCurrency.toUpperCase()}`}
                  >
                    <span className="text-lg" aria-hidden="true">
                      {currencyFlags[currentCurrency] || '💰'}
                    </span>
                    <span className="uppercase">{currentCurrency}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Select Currency</DropdownMenuLabel>
                  {currencies.map((currency: { code: string; name: string }) => (
                    <DropdownMenuItem
                      key={currency.code}
                      onClick={() => handleCurrencyChange(currency.code.toLowerCase())}
                      className={currentCurrency === currency.code.toLowerCase() ? 'bg-accent' : ''}
                    >
                      <span className="mr-2" aria-hidden="true">
                        {currencyFlags[currency.code.toLowerCase()] || '💰'}
                      </span>
                      <span className="font-medium">{currency.code}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        - {currency.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/settings')}>
                      Manage in Settings →
                    </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="User menu"
                    className="focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <UserIcon className="h-5 w-5" weight="regular" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.email}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {user.role?.toLowerCase()}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    Settings
                  </DropdownMenuItem>
                  {user.role === 'ADMIN' && (
                    <DropdownMenuItem onClick={() => router.push('/admin')}>
                      Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="text-destructive"
                  >
                    <SignOutIcon className="mr-2 h-4 w-4" />
                    {isLoggingOut ? 'Signing out...' : 'Sign out'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}