'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { useGetPaymentsQuery } from '@/store/api';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    SUCCEEDED: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELED: 'bg-gray-100 text-gray-800',
    REQUIRES_ACTION: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export default function PaymentsPage() {
  const { data, isLoading, error } = useGetPaymentsQuery();
  const [filter, setFilter] = useState<string>('all');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <div className="text-center py-12">Loading payment history...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            Failed to load payment history. Please try again.
          </div>
        </main>
      </div>
    );
  }

  const payments = data?.payments || [];
  const filteredPayments = filter === 'all' 
    ? payments 
    : payments.filter((p: any) => p.status === filter);

  const statusCounts = payments.reduce((acc: Record<string, number>, p: any) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Payment History</h1>
            <p className="text-gray-600 mt-1">
              View all your payments and their status
            </p>
          </div>
          <Link
            href="/payments/make"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
          >
            + Make Payment
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Payments</p>
            <p className="text-2xl font-bold">{payments.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Succeeded</p>
            <p className="text-2xl font-bold text-green-600">
              {statusCounts.SUCCEEDED || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {(statusCounts.PENDING || 0) + (statusCounts.PROCESSING || 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Failed</p>
            <p className="text-2xl font-bold text-red-600">
              {statusCounts.FAILED || 0}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['all', 'SUCCEEDED', 'PENDING', 'FAILED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status === 'all' ? 'All Payments' : status.charAt(0) + status.slice(1).toLowerCase()}
              {status !== 'all' && (
                <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {statusCounts[status] || 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">No payments found</p>
              <p className="text-sm">Make your first payment to see it here</p>
              <Link
                href="/payments/make"
                className="inline-block mt-4 text-blue-600 hover:underline"
              >
                Make a Payment →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                      Date
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                      Description
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                      Amount
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                      Status
                    </th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPayments.map((payment: any) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {payment.description || 'Payment'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {formatCurrency(payment.amount + (payment.taxAmount || 0), payment.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            payment.status
                          )}`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/payments/${payment.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination placeholder */}
        {filteredPayments.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Showing {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
          </div>
        )}
      </main>
    </div>
  );
}
