'use client';

import Link from 'next/link';
import { useLogoutMutation, useGetMeQuery } from '@/store/api';
import { clearCredentials } from '@/store/authSlice';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { data: user } = useGetMeQuery();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

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
            <Link href="/dashboard" className="text-xl font-bold">
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
            </div>
          </div>

          <div className="flex items-center gap-4">
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
