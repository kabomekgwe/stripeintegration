'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useGetSubscriptionPlansQuery, useGetSubscriptionQuery, useCreateSubscriptionMutation } from '@/store/api';
import Link from 'next/link';

function formatPrice(cents: number, interval: string, intervalCount: number): string {
  const dollars = (cents / 100).toFixed(2);
  if (intervalCount === 1) {
    return `$${dollars}/${interval.toLowerCase()}`;
  }
  return `$${dollars} every ${intervalCount} ${interval.toLowerCase()}s`;
}

export default function SubscriptionsPage() {
  const { data: plansData, isLoading: plansLoading } = useGetSubscriptionPlansQuery();
  const { data: subscriptionData, isLoading: subLoading } = useGetSubscriptionQuery();
  const [createSubscription, { isLoading: creating }] = useCreateSubscriptionMutation();
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month');

  if (plansLoading || subLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <div className="text-center">Loading...</div>
        </main>
      </div>
    );
  }

  const plans = plansData?.plans || [];
  const currentSubscription = subscriptionData?.current;

  const handleSubscribe = async (priceId: string) => {
    try {
      const result = await createSubscription({ priceId }).unwrap();
      // Handle client secret for 3D secure if needed
      console.log('Subscription created:', result);
    } catch (error) {
      console.error('Failed to create subscription:', error);
    }
  };

  // Show current subscription if active
  if (currentSubscription && ['ACTIVE', 'TRIALING'].includes(currentSubscription.status)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-3xl font-bold mb-8">Your Subscription</h1>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">{currentSubscription.plan.name}</h2>
                <p className="text-gray-600">{currentSubscription.plan.description}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                currentSubscription.status === 'ACTIVE'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {currentSubscription.status}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Current Period</p>
                <p className="font-medium">
                  {new Date(currentSubscription.currentPeriodStart).toLocaleDateString()} - {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Price</p>
                <p className="font-medium">
                  {formatPrice(currentSubscription.price.amount, currentSubscription.price.interval, currentSubscription.price.intervalCount)}
                </p>
              </div>
            </div>

            {currentSubscription.trialEnd && (
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p className="text-blue-800">
                  Trial ends on {new Date(currentSubscription.trialEnd).toLocaleDateString()}
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Go to Dashboard
              </Link>
              {currentSubscription.cancelAtPeriodEnd ? (
                <span className="text-red-600">Cancels at period end</span>
              ) : (
                <button className="text-red-600 hover:underline">
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">Select a subscription plan that fits your needs. All plans include access to our core features.</p>
          
          {/* Interval Toggle */}
          <div className="inline-flex bg-gray-200 rounded-lg p-1 mt-6">
            <button
              onClick={() => setSelectedInterval('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedInterval === 'month'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedInterval('year')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedInterval === 'year'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="ml-1 text-xs text-green-600">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan: any) => {
            const price = plan.prices.find((p: any) => 
              selectedInterval === 'month' ? p.interval === 'MONTH' : p.interval === 'YEAR'
            ) || plan.prices[0];
            
            return (
              <div
                key={plan.id}
                className="bg-white rounded-2xl shadow-lg p-8 flex flex-col"
              >
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-gray-500 text-sm mb-6">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold">
                    ${(price?.amount / 100 || 0).toFixed(0)}
                  </span>
                  <span className="text-gray-500">
                    {price?.interval === 'YEAR' ? '/year' : '/month'}
                  </span>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features?.map((feature: string, i: number) => (
                    <li key={i} className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(price?.id)}
                  disabled={creating}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Processing...' : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            No subscription plans available at the moment.
          </div>
        )}
      </main>
    </div>
  );
}
