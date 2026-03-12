'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useGetPaymentQuery, useCreateRefundMutation } from '@/store/api';

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params.id as string;
  
  const { data, isLoading } = useGetPaymentQuery(paymentId);
  const [createRefund, { isLoading: isRefunding }] = useCreateRefundMutation();
  
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);

  const payment = data?.payment;

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;

    try {
      const amountCents = refundAmount 
        ? Math.round(parseFloat(refundAmount) * 100)
        : undefined;

      await createRefund({
        paymentId,
        amount: amountCents,
        reason: refundReason,
      }).unwrap();

      setRefundSuccess(true);
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (err) {
      // Error handled by RTK Query
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="text-center">Loading...</div>
        </main>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="text-center">Payment not found</div>
        </main>
      </div>
    );
  }

  const isRefundable = payment.status === 'SUCCEEDED';
  const amount = (payment.amount / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold">Payment Details</h1>

        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="text-2xl font-bold">${amount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`rounded-full px-2 py-1 text-xs ${
                payment.status === 'SUCCEEDED'
                  ? 'bg-green-100 text-green-800'
                  : payment.status === 'FAILED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
              }`}>
                {payment.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Description</p>
              <p>{payment.description || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p>{new Date(payment.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500">Transaction ID</p>
              <p className="font-mono text-sm">{payment.stripePaymentIntentId}</p>
            </div>
          </div>

          {isRefundable && !showRefundForm && !refundSuccess && (
            <div className="mt-6 border-t pt-6">
              <button
                onClick={() => setShowRefundForm(true)}
                className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Request Refund
              </button>
            </div>
          )}

          {refundSuccess && (
            <div className="mt-6 rounded-md bg-green-50 p-4 text-green-800">
              Refund processed successfully! You will receive a confirmation email.
            </div>
          )}

          {showRefundForm && !refundSuccess && (
            <form onSubmit={handleRefund} className="mt-6 border-t pt-6 space-y-4">
              <h3 className="font-semibold">Request Refund</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Refund Amount (leave empty for full refund)
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="0.01"
                    max={amount}
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder={amount}
                    className="block w-full rounded-md border border-gray-300 py-2 pl-7 pr-3 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Maximum refundable: ${amount}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Reason
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3"
                >
                  <option value="requested_by_customer">Requested by customer</option>
                  <option value="duplicate">Duplicate payment</option>
                  <option value="fraudulent">Fraudulent</option>
                </select>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isRefunding}
                  className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isRefunding ? 'Processing...' : 'Confirm Refund'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRefundForm(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
