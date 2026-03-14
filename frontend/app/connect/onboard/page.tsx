'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateConnectedAccountMutation } from '@/store/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Store, Loader2 } from 'lucide-react';

const countries = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
];

export default function ConnectOnboardPage() {
  const router = useRouter();
  const [createAccount, { isLoading }] = useCreateConnectedAccountMutation();
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    country: '',
    businessType: 'individual' as 'individual' | 'company',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const result = await createAccount(formData).unwrap();
      if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl;
      } else {
        router.push('/connect');
      }
    } catch (err: any) {
      setError(err.data?.message || 'Failed to create account. Please try again.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader className="text-center">
          <Store className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-2xl">Become a Seller</CardTitle>
          <CardDescription>
            Create your seller account to start receiving payments. You'll be redirected to Stripe to complete verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Business Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={formData.country}
                onValueChange={(value: 'individual' | 'company') => setFormData({ ...formData, country: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Select
                value={formData.businessType}
                onValueChange={(value: 'individual' | 'company') =>
                  setFormData({ ...formData, businessType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual / Sole Proprietorship</SelectItem>
                  <SelectItem value="company">Company / Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">What happens next?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>We'll create your Stripe Connect account</li>
                <li>You'll be redirected to Stripe to verify your identity</li>
                <li>Connect your bank account for payouts</li>
                <li>Start receiving payments!</li>
              </ol>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Continue to Stripe'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
