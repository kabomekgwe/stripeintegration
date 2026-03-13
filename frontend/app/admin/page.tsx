'use client';

import { useGetAdminDashboardQuery } from '@/store/api';
import Link from 'next/link';

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useGetAdminDashboardQuery();

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Access denied or failed to load dashboard
      </div>
    );
  }

  const { metrics, recentTransactions, paymentMethods } = data!;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Lifetime</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Revenue Today</p>
          <p className="text-2xl font-bold">{formatCurrency(metrics.totalRevenueToday)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {metrics.totalRevenueThisMonth > 0 && `${((metrics.totalRevenueToday / metrics.totalRevenueThisMonth) * 100).toFixed(1)}% of month`}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Active Users</p>
          <p className="text-2xl font-bold">{metrics.activeUsers}</p>
          <p className="text-xs text-green-600 mt-1">+{metrics.newUsersToday} today</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Payments</p>
          <p className="text-2xl font-bold">{metrics.totalPayments}</p>
          <p className="text-xs text-gray-400 mt-1">
            {metrics.successfulPayments} successful
          </p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Average Transaction</p>
          <p className="text-xl font-bold">{formatCurrency(metrics.averageTransaction)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Refunds</p>
          <p className="text-xl font-bold">{metrics.totalRefunds}</p>
          <p className="text-xs text-red-500">{formatCurrency(metrics.refundAmount)} refunded</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Success Rate</p>
          <p className="text-xl font-bold">
            {metrics.totalPayments > 0
              ? `${((metrics.successfulPayments / metrics.totalPayments) * 100).toFixed(1)}%`
              : '0%'}
          </p>
          <p className="text-xs text-red-500">{metrics.failedPayments} failed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <Link href="/admin/transactions" className="text-blue-600 text-sm hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y">
            {recentTransactions.map((tx: any) => (
              <div key={tx.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{tx.userEmail}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(tx.amount)} • {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      tx.status === 'SUCCEEDED'
                        ? 'bg-green-100 text-green-800'
                        : tx.status === 'FAILED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Payment Methods</h2>
          </div>
          <div className="p-6">
            {paymentMethods.map((pm: any) => (
              <div key={pm.method} className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                    {pm.method === 'visa' && '💳'}
                    {pm.method === 'mastercard' && '💳'}
                    {pm.method === 'amex' && '💳'}
                    {pm.method === 'sepa_debit' && '🏦'}
                    {pm.method === 'Unknown' && '❓'}
                  </div>
                  <div>
                    <p className="font-medium capitalize">{pm.method}</p>
                    <p className="text-sm text-gray-500">{pm.count} methods</p>
                  </div>
                </div>
                <p className="font-medium">{formatCurrency(pm.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Link
          href="/admin/users"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="font-semibold mb-2">👥 Manage Users</h3>
          <p className="text-sm text-gray-500">View and manage user accounts</p>
        </Link>
        <Link
          href="/admin/revenue"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="font-semibold mb-2">📊 Revenue Analytics</h3>
          <p className="text-sm text-gray-500">View revenue trends and reports</p>
        </Link>
        <Link
          href="/admin/transactions"
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="font-semibold mb-2">💰 All Transactions</h3>
          <p className="text-sm text-gray-500">View complete transaction history</p>
        </Link>
      </div>
    </div>
  );
}
