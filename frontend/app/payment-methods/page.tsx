'use client';

import Link from 'next/link';
import { useGetPaymentMethodsQuery, useGetEnabledPaymentMethodsQuery, useSetDefaultPaymentMethodMutation, useRemovePaymentMethodMutation } from '@/store/api';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CreditCardIcon,
  BankIcon,
  WalletIcon,
  LinkIcon,
  MoneyIcon,
  ShoppingCartIcon,
  DeviceMobileIcon,
  GlobeIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  WarningCircleIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react';

// Map Stripe payment method types to display names and icons
const PAYMENT_METHOD_INFO: Record<string, { 
  name: string; 
  icon: React.ComponentType<{ className?: string; weight?: string }>;
  color: string;
  wallets?: string[];
}> = {
  card: { 
    name: 'Credit/Debit Card', 
    icon: CreditCardIcon, 
    color: 'text-blue-600 bg-blue-50',
    wallets: ['Apple Pay', 'Google Pay'] 
  },
  us_bank_account: { 
    name: 'US Bank Account (ACH)', 
    icon: BankIcon, 
    color: 'text-green-600 bg-green-50' 
  },
  link: { 
    name: 'Link', 
    icon: LinkIcon, 
    color: 'text-purple-600 bg-purple-50' 
  },
  cashapp: { 
    name: 'Cash App Pay', 
    icon: MoneyIcon, 
    color: 'text-green-600 bg-green-50' 
  },
  affirm: { 
    name: 'Affirm', 
    icon: ShoppingCartIcon, 
    color: 'text-indigo-600 bg-indigo-50' 
  },
  afterpay_clearpay: { 
    name: 'Afterpay / Clearpay', 
    icon: ShoppingCartIcon, 
    color: 'text-pink-600 bg-pink-50' 
  },
  klarna: { 
    name: 'Klarna', 
    icon: ShoppingCartIcon, 
    color: 'text-pink-600 bg-pink-50' 
  },
  sepa_debit: { 
    name: 'SEPA Direct Debit', 
    icon: BankIcon, 
    color: 'text-blue-600 bg-blue-50' 
  },
  bacs_debit: { 
    name: 'BACS Direct Debit', 
    icon: BankIcon, 
    color: 'text-blue-600 bg-blue-50' 
  },
  au_becs_debit: { 
    name: 'BECS Direct Debit', 
    icon: BankIcon, 
    color: 'text-blue-600 bg-blue-50' 
  },
  bancontact: { 
    name: 'Bancontact', 
    icon: CreditCardIcon, 
    color: 'text-blue-600 bg-blue-50' 
  },
  ideal: { 
    name: 'iDEAL', 
    icon: BankIcon, 
    color: 'text-cyan-600 bg-cyan-50' 
  },
  giropay: { 
    name: 'Giropay', 
    icon: BankIcon, 
    color: 'text-blue-600 bg-blue-50' 
  },
  eps: { 
    name: 'EPS', 
    icon: BankIcon, 
    color: 'text-green-600 bg-green-50' 
  },
  p24: { 
    name: 'P24', 
    icon: BankIcon, 
    color: 'text-red-600 bg-red-50' 
  },
  sofort: { 
    name: 'Sofort', 
    icon: BankIcon, 
    color: 'text-blue-600 bg-blue-50' 
  },
  wechat_pay: { 
    name: 'WeChat Pay', 
    icon: DeviceMobileIcon, 
    color: 'text-green-600 bg-green-50' 
  },
  alipay: { 
    name: 'Alipay', 
    icon: DeviceMobileIcon, 
    color: 'text-blue-600 bg-blue-50' 
  },
};

// Card brand icons mapping
const CARD_BRAND_ICONS: Record<string, React.ComponentType<{ className?: string; weight?: string }>> = {
  visa: CreditCardIcon,
  mastercard: CreditCardIcon,
  amex: CreditCardIcon,
  discover: CreditCardIcon,
  jcb: CreditCardIcon,
  diners: CreditCardIcon,
  unionpay: CreditCardIcon,
};

function PaymentMethodSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function EnabledMethodSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-10 w-40 rounded-full" />
    </div>
  );
}

export default function PaymentMethodsPage() {
  const { data, isLoading } = useGetPaymentMethodsQuery();
  const { data: enabledData, isLoading: isLoadingEnabled } = useGetEnabledPaymentMethodsQuery();
  const [setDefault, { isLoading: isSettingDefault }] = useSetDefaultPaymentMethodMutation();
  const [remove, { isLoading: isRemoving }] = useRemovePaymentMethodMutation();

  const paymentMethods = data?.paymentMethods || [];
  // API now returns a list of payment method configurations
  const paymentMethodConfigurations = enabledData?.paymentMethodConfigurations || [];
  // Filter active configurations and map to usable format
  const enabledPaymentMethods = paymentMethodConfigurations
    .filter((config) => config.active)
    .map((config) => ({
      // Use parent (e.g., "card") if available, otherwise use id
      type: config.parent || config.id,
      displayName: config.displayName,
      id: config.id,
    }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payment Methods</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your saved payment methods and view available options
            </p>
          </div>
          <Button asChild>
            <Link href="/payment-methods/add" className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Add Payment Method
            </Link>
          </Button>
        </div>

        {/* Enabled Payment Methods Section */}
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <WalletIcon className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Available Payment Methods</CardTitle>
            </div>
            <CardDescription>
              Payment methods enabled in your Stripe account for checkout
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEnabled ? (
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <EnabledMethodSkeleton key={i} />
                ))}
              </div>
            ) : enabledPaymentMethods.length === 0 ? (
              <Alert variant="warning">
                <WarningCircleIcon className="h-4 w-4" />
                <AlertDescription>
                  No payment methods enabled. Enable them in your{' '}
                  <a
                    href="https://dashboard.stripe.com/settings/payments"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline hover:no-underline"
                  >
                    Stripe Dashboard
                  </a>
                  .
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-wrap gap-3">
                {enabledPaymentMethods.map((pm) => {
                  // Look up icon/info by the type (parent or id)
                  const info = PAYMENT_METHOD_INFO[pm.type] || { 
                    name: pm.displayName || pm.type, 
                    icon: CreditCardIcon, 
                    color: 'text-gray-600 bg-gray-50' 
                  };
                  const Icon = info.icon;
                  return (
                    <div key={pm.id} className="flex flex-col">
                      <div
                        className={`flex items-center gap-2 rounded-full border px-4 py-2 ${info.color.replace('text-', 'border-').replace('bg-', 'bg-opacity-50 bg-')}`}
                      >
                        <Icon className={`h-4 w-4 ${info.color.split(' ')[0]}`} weight="fill" />
                        <span className="text-sm font-medium">{info.name}</span>
                      </div>
                      {info.wallets && (
                        <span className="mt-1 text-xs text-muted-foreground pl-2">
                          Supports: {info.wallets.join(', ')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Payment Methods Section */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <CreditCardIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Your Saved Payment Methods</h2>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <PaymentMethodSkeleton key={i} />
              ))}
            </div>
          ) : paymentMethods.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <CreditCardIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">No payment methods saved</h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Add a payment method to make checkout faster and easier. Your payment information is securely stored by Stripe.
                </p>
                <Button asChild className="mt-6 gap-2">
                  <Link href="/payment-methods/add">
                    <PlusIcon className="h-4 w-4" />
                    Add Payment Method
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((method) => {
                const Icon = method.brand 
                  ? (CARD_BRAND_ICONS[method.brand.toLowerCase()] || CreditCardIcon)
                  : CreditCardIcon;
                
                return (
                  <Card 
                    key={method.id} 
                    className={method.isDefault ? 'border-primary ring-1 ring-primary' : ''}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <Icon className="h-6 w-6 text-primary" weight="fill" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">
                                {method.brand 
                                  ? `${method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• ${method.last4}`
                                  : 'Card'}
                              </p>
                              {method.isDefault && (
                                <Badge variant="default" className="gap-1">
                                  <StarIcon className="h-3 w-3" weight="fill" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            {method.expMonth && method.expYear && (
                              <p className="text-sm text-muted-foreground">
                                Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!method.isDefault && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDefault(method.id)}
                              disabled={isSettingDefault}
                              className="gap-1"
                            >
                              <StarIcon className="h-3.5 w-3.5" />
                              Set Default
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => remove(method.id)}
                            disabled={isRemoving}
                            className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="mt-8 flex items-start gap-3 rounded-lg bg-muted/50 p-4">
          <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 shrink-0" weight="fill" />
          <div>
            <p className="text-sm font-medium">Secure Payment Storage</p>
            <p className="text-sm text-muted-foreground">
              Your payment information is securely stored and processed by Stripe. 
              We never store your full card details on our servers.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
