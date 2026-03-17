'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SetupIntentForm } from '@/components/stripe/SetupIntentForm';
import { StripeProvider } from '@/components/stripe/StripeProvider';
import { getStripe, isStripeConfigured } from '@/lib/stripe-client';
import { useCreateSetupIntentMutation, useGetPaymentMethodsQuery, useSavePaymentMethodMutation } from '@/store/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCardIcon, 
  Building2Icon, 
  PlusIcon, 
  CheckIcon,
  ArrowLeftIcon,
  Loader2Icon 
} from 'lucide-react';

interface PaymentMethod {
  id: string;
  stripePmId: string;
  type: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  accountType?: string;
  isDefault: boolean;
}

export default function AddPaymentMethodPage() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [stripeConfigError, setStripeConfigError] = useState<string | null>(null);
  const [selectingMethod, setSelectingMethod] = useState(false);

  const { data: paymentMethodsData, isLoading: loadingMethods } = useGetPaymentMethodsQuery();
  const [createSetupIntent, { isLoading: creatingIntent, error }] = useCreateSetupIntentMutation();
  const [savePaymentMethod, { isLoading: savingMethod }] = useSavePaymentMethodMutation();

  const paymentMethods: PaymentMethod[] = paymentMethodsData?.paymentMethods || [];

  useEffect(() => {
    if (!isStripeConfigured()) {
      setStripeConfigError('Stripe is not properly configured. Please check your environment variables.');
    }
  }, []);

  const handleCreateSetupIntent = (paymentMethodId?: string) => {
    createSetupIntent({ paymentMethodId })
      .unwrap()
      .then(result => setClientSecret(result.clientSecret))
      .catch(err => console.error('Failed to create setup intent:', err));
  };

  // Auto-create setup intent when showing new form
  useEffect(() => {
    if (showNewForm && !clientSecret && !stripeConfigError) {
      handleCreateSetupIntent();
    }
  }, [showNewForm, clientSecret, stripeConfigError]);

  const handleSelectExisting = async (method: PaymentMethod) => {
    setSelectingMethod(true);
    try {
      // Create a setup intent for the existing payment method
      await handleCreateSetupIntent(method.stripePmId);
      setSelectedMethod(method);
    } catch (err) {
      console.error('Failed to set up payment method:', err);
    } finally {
      setSelectingMethod(false);
    }
  };

  const handleAddNew = () => {
    setSelectedMethod(null);
    setShowNewForm(true);
    setClientSecret(null); // Will be created in useEffect
  };

  const handleUseSelectedMethod = async () => {
    if (!selectedMethod) return;
    
    setSelectingMethod(true);
    try {
      // Save the existing payment method to our database
      await savePaymentMethod(selectedMethod.stripePmId).unwrap();
      setSetupComplete(true);
      setTimeout(() => router.push('/payment-methods'), 2000);
    } catch (err) {
      console.error('Failed to save payment method:', err);
    } finally {
      setSelectingMethod(false);
    }
  };

  const handleSetupSuccess = () => {
    setSetupComplete(true);
    setTimeout(() => router.push('/payment-methods'), 2000);
  };

  const handleCancel = () => {
    if (showNewForm || selectedMethod) {
      setShowNewForm(false);
      setSelectedMethod(null);
      setClientSecret(null);
    } else {
      router.push('/payment-methods');
    }
  };

  const getCardDisplay = (method: PaymentMethod) => {
    if (method.type === 'card') {
      return {
        primary: method.brand 
          ? `${method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• ${method.last4}`
          : `Card •••• ${method.last4}`,
        secondary: method.expMonth && method.expYear 
          ? `Expires ${method.expMonth.toString().padStart(2, '0')}/${method.expYear}`
          : undefined,
      };
    }
    if (method.type === 'us_bank_account') {
      return {
        primary: method.bankName || 'Bank Account',
        secondary: `${method.last4 ? `•••• ${method.last4}` : ''} ${method.accountType ? `• ${method.accountType}` : ''}`.trim(),
      };
    }
    return {
      primary: method.type,
      secondary: method.last4 ? `•••• ${method.last4}` : undefined,
    };
  };

  const getIcon = (method: PaymentMethod) => {
    if (method.type === 'card') {
      return CreditCardIcon;
    }
    return Building2Icon;
  };

  // Loading state
  if (loadingMethods) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="text-blue-600 hover:underline text-sm flex items-center gap-1"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Payment Methods
          </button>
        </div>

        <h1 className="text-3xl font-bold mb-2">Add Payment Method</h1>
        <p className="text-gray-600 mb-8">
          {!showNewForm && !selectedMethod
            ? 'Select an existing payment method or add a new one.'
            : 'Your payment information is securely handled by Stripe.'}
        </p>

        {stripeConfigError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {stripeConfigError}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            Failed to initialize payment form.{' '}
            <button
              onClick={() => window.location.reload()}
              className="underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Success State */}
        {setupComplete ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-green-800 mb-2">
              {selectedMethod ? 'Payment Method Selected!' : 'Payment Method Added!'}
            </h2>
            <p className="text-gray-600 mb-4">
              {selectedMethod 
                ? `You're now using ${getCardDisplay(selectedMethod).primary}`
                : 'Your payment method has been saved successfully.'}
              Redirecting you back...
            </p>
            <Link
              href="/payment-methods"
              className="text-blue-600 hover:underline"
            >
              Go to Payment Methods now →
            </Link>
          </div>
        ) : (
          <>
            {/* Existing Payment Methods */}
            {!showNewForm && !selectedMethod && (
              <div className="space-y-4">
                {paymentMethods.length > 0 ? (
                  <>
                    <h2 className="text-lg font-semibold text-gray-700">
                      Existing Payment Methods
                    </h2>
                    <p className="text-sm text-gray-500">
                      Select a payment method below to use it directly, or add a new one.
                    </p>
                    <div className="space-y-3">
                      {paymentMethods.map((method) => {
                        const display = getCardDisplay(method);
                        const Icon = getIcon(method);
                        return (
                          <Card 
                            key={method.id} 
                            className="cursor-pointer hover:border-blue-400 transition-colors"
                          >
                            <CardContent className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
                                  <Icon className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-semibold">{display.primary}</p>
                                  {display.secondary && (
                                    <p className="text-sm text-gray-500">{display.secondary}</p>
                                  )}
                                </div>
                                {method.isDefault && (
                                  <Badge variant="secondary" className="ml-2">Default</Badge>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSelectExisting(method)}
                                disabled={selectingMethod}
                              >
                                {selectingMethod ? (
                                  <Loader2Icon className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Use This'
                                )}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-gray-50 px-4 text-gray-500">Or</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm mb-4">
                    You don't have any saved payment methods yet.
                  </p>
                )}

                {/* Add New Button */}
                <Button
                  onClick={handleAddNew}
                  className="w-full gap-2"
                  variant={paymentMethods.length === 0 ? 'default' : 'outline'}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add New Payment Method
                </Button>
              </div>
            )}

            {/* Selected Method Confirmation */}
            {selectedMethod && !showNewForm && (
              <div className="space-y-4">
                <Card className="border-blue-300">
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <CheckIcon className="h-5 w-5 text-green-600" />
                      Selected Payment Method
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center">
                        {(() => {
                          const Icon = getIcon(selectedMethod);
                          return <Icon className="h-7 w-7 text-blue-600" />;
                        })()}
                      </div>
                      <div>
                        <p className="text-lg font-semibold">
                          {getCardDisplay(selectedMethod).primary}
                        </p>
                        {getCardDisplay(selectedMethod).secondary && (
                          <p className="text-gray-500">
                            {getCardDisplay(selectedMethod).secondary}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="flex-1"
                    disabled={savingMethod}
                  >
                    Choose Different
                  </Button>
                  <Button
                    onClick={handleUseSelectedMethod}
                    className="flex-1"
                    disabled={savingMethod}
                  >
                    {savingMethod ? (
                      <>
                        <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Confirm & Use This Card'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* New Payment Method Form */}
            {showNewForm && clientSecret && (
              <StripeProvider
                stripe={getStripe()}
                options={{ clientSecret }}
              >
                <div className="bg-white rounded-lg shadow p-6">
                  <SetupIntentForm
                    clientSecret={clientSecret}
                    onSuccess={handleSetupSuccess}
                    onCancel={handleCancel}
                  />
                </div>
              </StripeProvider>
            )}

            {/* Loading for new form */}
            {showNewForm && !clientSecret && (creatingIntent || stripeConfigError) && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <CreditCardIcon className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-gray-800">
                  Preparing Secure Payment Form...
                </h2>
                <p className="text-gray-600">Please wait while we set up the payment form.</p>
              </div>
            )}
          </>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            🔒 Your payment information is processed securely by Stripe.
            We never store your full payment details.
          </p>
        </div>
      </main>
    </div>
  );
}
