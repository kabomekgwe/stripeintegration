import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900">
          Stripe Payments
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Embedded payments, usage-based billing, and customer management
        </p>
        
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/auth/register"
            className="rounded-lg bg-blue-600 px-6 py-3 text-lg font-medium text-white hover:bg-blue-700"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-lg font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="text-3xl">💳</div>
            <h3 className="mt-2 font-semibold">Save Payment Methods</h3>
            <p className="mt-1 text-sm text-gray-500">
              Securely store cards and bank accounts for future payments
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="text-3xl">⚡</div>
            <h3 className="mt-2 font-semibold">Instant Payments</h3>
            <p className="mt-1 text-sm text-gray-500">
              Pay any amount without leaving the app
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="text-3xl">📊</div>
            <h3 className="mt-2 font-semibold">Usage Billing</h3>
            <p className="mt-1 text-sm text-gray-500">
              Automatic monthly billing based on your usage
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
