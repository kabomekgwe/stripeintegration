'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { useGetUsageQuery, useRecordUsageMutation, useGetBillingPreviewQuery } from '@/store/api';

export default function UsagePage() {
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'record'>('current');
  const [usageCount, setUsageCount] = useState(1);
  const [amount, setAmount] = useState(100); // Amount in cents
  const [description, setDescription] = useState('');
  
  const { data: usageData, isLoading: usageLoading } = useGetUsageQuery();
  const { data: billingData, isLoading: previewLoading } = useGetBillingPreviewQuery(undefined, {
    skip: activeTab !== 'current',
  });
  const [recordUsage, { isLoading: recording }] = useRecordUsageMutation();

  // Get current period in YYYY-MM format
  const currentPeriod = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Process usage records to get current month and history
  const allUsage = usageData?.usage || [];
  const currentMonthRecord = allUsage.find(u => u.period === currentPeriod);
  const history = allUsage.filter(u => u.period !== currentPeriod);

  // Calculate current month totals
  const currentMonthTotals = useMemo(() => {
    if (currentMonthRecord) {
      return {
        usageCount: currentMonthRecord.usageCount,
        amount: currentMonthRecord.amount,
        billed: currentMonthRecord.billed,
      };
    }
    return { usageCount: 0, amount: 0, billed: false };
  }, [currentMonthRecord]);

  const handleRecordUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usageCount <= 0 || amount <= 0) return;

    try {
      await recordUsage({
        usageCount,
        amount,
        description: description || undefined,
      }).unwrap();
      setUsageCount(1);
      setAmount(100);
      setDescription('');
      alert('Usage recorded successfully!');
    } catch (err) {
      console.error('Failed to record usage:', err);
      alert('Failed to record usage. Please try again.');
    }
  };

  const preview = billingData?.preview;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Usage Tracking</h1>
            <p className="text-gray-600 mt-1">
              Track your usage and view billing history
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:underline"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-8">
            {[
              { id: 'current', label: 'Current Month' },
              { id: 'history', label: 'Usage History' },
              { id: 'record', label: 'Record Usage' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Current Month Tab */}
        {activeTab === 'current' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-500 mb-1">Current Period</p>
                <p className="text-2xl font-bold">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-500 mb-1">Usage Count</p>
                <p className="text-2xl font-bold text-blue-600">
                  {currentMonthTotals.usageCount}
                </p>
                <p className="text-sm text-gray-500">recorded this month</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-500 mb-1">Billed Amount</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(currentMonthTotals.amount / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500">
                  {currentMonthTotals.billed ? 'Billed' : 'Pending'}
                </p>
              </div>
            </div>

            {previewLoading ? (
              <div className="text-center py-8">Loading preview...</div>
            ) : preview ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Billing Preview (Next Cycle)</h3>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Period</span>
                    <span className="font-medium">{preview.period}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Total Usage</span>
                    <span className="font-medium">{preview.usageCount || 0} units</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Estimated Total</span>
                    <span className="font-bold text-lg">
                      ${((preview.totalAmount || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No usage history</p>
                <p className="text-sm">Record your first usage to see it here</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Period</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Usage</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Amount</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.map((record: any) => (
                    <tr key={record.period} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{record.period}</td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {record.usageCount} units
                      </td>
                      <td className="px-6 py-4 text-sm">
                        ${(record.amount / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          record.billed
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.billed ? 'Billed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Record Usage Tab */}
        {activeTab === 'record' && (
          <div className="max-w-xl mx-auto">
            <form onSubmit={handleRecordUsage} className="bg-white rounded-lg shadow p-6">
              <div className="space-y-6">
                <div>
                  <label htmlFor="usageCount" className="block text-sm font-medium text-gray-700 mb-2">
                    Usage Count
                  </label>
                  <input
                    type="number"
                    id="usageCount"
                    min="1"
                    required
                    value={usageCount}
                    onChange={(e) => setUsageCount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter usage count"
                  />
                </div>

                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (cents)
                  </label>
                  <input
                    type="number"
                    id="amount"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter amount in cents"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Equivalent to ${(amount / 100).toFixed(2)}
                  </p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., API calls, data processing, etc."
                    maxLength={255}
                  />
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Usage Tips</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>Usage is tracked monthly and billed automatically</li>
                    <li>You can record usage multiple times per month</li>
                    <li>Billed at the end of each month cycle</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={recording || usageCount <= 0 || amount <= 0}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {recording ? 'Recording...' : 'Record Usage'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
