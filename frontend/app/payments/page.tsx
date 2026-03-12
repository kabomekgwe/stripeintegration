'use client';

import { useGetPaymentsQuery, useRetryPaymentMutation } from '@/store/api';
import { Navbar } from '@/components/Navbar';

export default function PaymentsPage() {
  const { data, isLoading } = useGetPaymentsQuery();
  const [retry, { isLoading: isRetrying }] = useRetryPaymentMutation();

  const payments = data?.payments || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Payment History</h1>

        {isLoading ? (
          <div className="mt-8 text-center">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="mt-8 rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-500">No payments yet</p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {payment.description || 'Payment'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      ${(payment.amount / 100).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          payment.status === 'SUCCEEDED'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : payment.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {payment.status === 'FAILED' && (
                        <button
                          onClick={() => retry(payment.id)}
                          disabled={isRetrying}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
