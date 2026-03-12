'use client';

import Link from 'next/link';
import { useGetPaymentMethodsQuery, useSetDefaultPaymentMethodMutation, useRemovePaymentMethodMutation } from '@/store/api';
import { Navbar } from '@/components/Navbar';

export default function PaymentMethodsPage() {
  const { data, isLoading } = useGetPaymentMethodsQuery();
  const [setDefault, { isLoading: isSettingDefault }] = useSetDefaultPaymentMethodMutation();
  const [remove, { isLoading: isRemoving }] = useRemovePaymentMethodMutation();

  const paymentMethods = data?.paymentMethods || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Payment Methods</h1>
          <Link
            href="/payment-methods/add"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Add New
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-8 text-center">Loading...</div>
        ) : paymentMethods.length === 0 ? (
          <div className="mt-8 rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-500">No payment methods saved yet</p>
            <Link
              href="/payment-methods/add"
              className="mt-4 inline-block text-blue-600 hover:underline"
            >
              Add your first payment method →
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`rounded-lg bg-white p-6 shadow ${
                  method.isDefault ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg font-bold">
                      {method.brand?.[0]?.toUpperCase() || '💳'}
                    </div>
                    <div>
                      <p className="font-medium">
                        {method.brand?.toUpperCase() || 'Card'} **** {method.last4}
                      </p>
                      <p className="text-sm text-gray-500">
                        Expires {method.expMonth}/{method.expYear}
                      </p>
                    </div>
                    {method.isDefault && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                        Default
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <button
                        onClick={() => setDefault(method.id)}
                        disabled={isSettingDefault}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => remove(method.id)}
                      disabled={isRemoving}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
