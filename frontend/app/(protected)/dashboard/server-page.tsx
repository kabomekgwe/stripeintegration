import { requireAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

/**
 * Dashboard Page - Server Component
 * 
 * This is a React Server Component that:
 * 1. Authenticates the user server-side
 * 2. Fetches data server-side
 * 3. Renders HTML with no client-side JavaScript
 */
export default async function DashboardPage() {
  // Require authentication (redirects to login if not authenticated)
  const session = await requireAuth();
  
  // Fetch data server-side
  const payments = await apiClient<{ payments: any[] }>('payments').catch(() => ({ payments: [] }));
  const usage = await apiClient<{ usage: any[] }>('usage').catch(() => ({ usage: [] }));
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-600">
                Welcome back, {session.user.name || session.user.email}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Currency: {session.user.preferredCurrency?.toUpperCase() || 'USD'}
              </span>
              <Link
                href="/settings"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Payments Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Payments</h2>
            <p className="text-3xl font-bold text-gray-900">
              {payments.payments.length}
            </p>
            <p className="text-sm text-gray-600 mt-1">Total transactions</p>
            <Link
              href="/payments"
              className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              View all payments →
            </Link>
          </div>

          {/* Usage Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Usage Records</h2>
            <p className="text-3xl font-bold text-gray-900">
              {usage.usage.length}
            </p>
            <p className="text-sm text-gray-600 mt-1">Total usage records</p>
            <Link
              href="/usage"
              className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              View usage →
            </Link>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href="/payment-methods"
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                Manage Payment Methods
              </Link>
              <Link
                href="/subscriptions"
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                View Subscriptions
              </Link>
              <Link
                href="/settings"
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                Account Settings
              </Link>
            </div>
          </div>
        </div>

        {/* Server Component Badge */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Server Component</strong> - This page is rendered on the server 
            with no client-side JavaScript. Authentication and data fetching happen 
            server-side for better performance and security.
          </p>
        </div>
      </main>
    </div>
  );
}
