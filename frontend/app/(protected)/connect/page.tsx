'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGetConnectedAccountQuery, useCreateOnboardingLinkMutation, useCreateLoginLinkMutation } from '@/store/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, ExternalLink, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

export default function ConnectPage() {
  const { data: account, isLoading } = useGetConnectedAccountQuery();
  const [createOnboardingLink, { isLoading: isCreatingOnboarding }] = useCreateOnboardingLinkMutation();
  const [createLoginLink, { isLoading: isCreatingLogin }] = useCreateLoginLinkMutation();

  const handleOnboarding = async () => {
    try {
      const result = await createOnboardingLink().unwrap();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('Failed to create onboarding link:', error);
    }
  };

  const handleLogin = async () => {
    try {
      const result = await createLoginLink().unwrap();
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to create login link:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Seller Account</h1>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = account?.status === 'active';
  const isPending = account?.status === 'pending';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Seller Account</h1>
        {account && (
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Active' : 'Pending Setup'}
          </Badge>
        )}
      </div>

      {!account ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Store className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Become a Seller</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Set up your seller account to start receiving payments directly to your bank account.
              We use Stripe Connect for secure payment processing.
            </p>
            <Link href="/connect/onboard">
              <Button size="lg">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
              <CardDescription>
                Your connected account status and capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Charges</p>
                  <div className="flex items-center gap-2">
                    {account.stripeData?.chargesEnabled ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Enabled</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">Pending</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Payouts</p>
                  <div className="flex items-center gap-2">
                    {account.stripeData?.payoutsEnabled ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Enabled</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">Pending</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isPending && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    <strong>Action Required:</strong> Please complete your account setup to start receiving payments.
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                {isPending && (
                  <Button onClick={handleOnboarding} disabled={isCreatingOnboarding}>
                    Complete Setup
                  </Button>
                )}
                <Button variant="outline" onClick={handleLogin} disabled={isCreatingLogin}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Stripe Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Email</span>
                <span>{account.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Country</span>
                <span>{account.country}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Business Type</span>
                <span className="capitalize">{account.businessType}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Account ID</span>
                <span className="font-mono text-sm">{account.stripeAccountId}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
