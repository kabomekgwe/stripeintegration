'use client';

import Link from 'next/link';
import { 
  useGetMeQuery,
  useGetPaymentMethodsQuery,
  useGetBillingPreviewQuery,
  useGetPaymentsQuery
} from '@/store/api';

export default function DashboardPage() {
  const { data: user } = useGetMeQuery();
  const { data: paymentMethodsData } = useGetPaymentMethodsQuery();
  const { data: billingPreview } = useGetBillingPreviewQuery();
  const { data: paymentsData } = useGetPaymentsQuery();

  const paymentMethods = paymentMethodsData?.paymentMethods || [];
  const payments = paymentsData?.payments || [];
  const preview = billingPreview?.preview;

  const defaultPaymentMethod = paymentMethods.find((pm) => pm.isDefault);
  const recentPayments = payments.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back, {user?.name || user?.email}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Payment Method Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Default Payment Method</h2>
          {defaultPaymentMethod ? (
            <div className="mt-4">
              <p className="font-medium">
                {defaultPaymentMethod.brand?.toUpperCase()} ****{' '}
                {defaultPaymentMethod.last4}
              </p>
              <p className="text-sm text-gray-500">
                Expires {defaultPaymentMethod.expMonth}/
                {defaultPaymentMethod.expYear}
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-gray-500">No default payment method</p>
              <Link
                href="/payment-methods"
                className="mt-2 inline-block text-blue-600 hover:underline"
              >
                Add one now →
              </Link>
            </div>
          )}
        </div>

        {/* Current Usage Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Current Usage</h2>
          {preview ? (
            <div className="mt-4">
              <p className="text-2xl font-bold">
                ${(preview.totalAmount / 100).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">
                {preview.usageCount} units this period
              </p>
              <p className="text-xs text-gray-400">Period: {preview.period}</p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-gray-500">No usage recorded this period</p>
            </div>
          )}
        </div>

        {/* Quick Actions Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <div className="mt-4 space-y-2">
            <Link
              href="/payments/make"
              className="block rounded-md bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700"
            >
              Make Payment
            </Link>
            <Link
              href="/payment-methods/add"
              className="block rounded-md border border-gray-300 px-4 py-2 text-center text-gray-700 hover:bg-gray-50"
            >
              Add Payment Method
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Payments</h2>
          <Link
            href="/payments"
            className="text-sm text-blue-600 hover:underline"
          >
            View all →
          </Link>
        </div>

        {recentPayments.length > 0 ? (
          <div className="mt-4 divide-y">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center py-3">
                <div className="flex-1">
                  <p className="font-medium">
                    ${(payment.amount / 100).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {payment.description || 'Payment'}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      payment.status === 'SUCCEEDED'
                        ? 'bg-green-100 text-green-800'
                        : payment.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {payment.status}
                  </span>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(payment.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-gray-500">No payments yet</p>
        )}
      </div>
    </div>
  );
}
