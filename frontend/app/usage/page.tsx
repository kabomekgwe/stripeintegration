'use client';

import { 
  useGetUsageQuery, 
  useGetBillingPreviewQuery, 
  useGenerateBillingMutation 
} from '@/store/api';
import { Navbar } from '@/components/Navbar';

export default function UsagePage() {
  const { data: usageData, isLoading } = useGetUsageQuery();
  const { data: billingPreview } = useGetBillingPreviewQuery();
  const [generateBilling, { isLoading: isGenerating }] = useGenerateBillingMutation();

  const usage = usageData?.usage || [];
  const preview = billingPreview?.preview;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Usage & Billing</h1>
          <button
            onClick={() => generateBilling()}
            disabled={isGenerating}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isGenerating ? 'Processing...' : 'Generate Bill Now'}
          </button>
        </div>

        {/* Current Period Preview */}
        {preview && (
          <div className="mt-8 rounded-lg bg-blue-50 p-6">
            <h2 className="text-lg font-semibold text-blue-900">
              Current Period: {preview.period}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-blue-600">Total Amount</p>
                <p className="text-2xl font-bold text-blue-900">
                  ${(preview.totalAmount / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Usage Count</p>
                <p className="text-2xl font-bold text-blue-900">
                  {preview.usageCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-600">Description</p>
                <p className="text-blue-900">{preview.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Usage History */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold">Usage History</h2>

          {isLoading ? (
            <div className="mt-4 text-center">Loading...</div>
          ) : usage.length === 0 ? (
            <div className="mt-4 rounded-lg bg-white p-8 text-center shadow">
              <p className="text-gray-500">No usage recorded yet</p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg bg-white shadow">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Usage Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usage.map((record) => (
                    <tr key={record.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {record.period}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {record.description || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {record.usageCount}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        ${(record.amount / 100).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {record.billed ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                            Billed
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
