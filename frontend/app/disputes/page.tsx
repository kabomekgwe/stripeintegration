'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGetMyDisputesQuery } from '@/store/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { AlertTriangle, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const statusConfig = {
  needs_response: { label: 'Needs Response', color: 'bg-yellow-500', icon: Clock },
  won: { label: 'Won', color: 'bg-green-500', icon: CheckCircle },
  lost: { label: 'Lost', color: 'bg-red-500', icon: XCircle },
  warning_needs_response: { label: 'Warning', color: 'bg-orange-500', icon: AlertTriangle },
};

export default function DisputesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetMyDisputesQuery({ limit: 10, offset: (page - 1) * 10 });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">My Disputes</h1>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full mt-4" />
            <Skeleton className="h-20 w-full mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const disputes = data?.disputes || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Disputes</h1>
      </div>

      {disputes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Disputes</h3>
            <p className="text-muted-foreground">
              Great news! You don&apos;t have any chargeback disputes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Active Disputes ({total})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {disputes.map((dispute: any) => {
                  const status = statusConfig[dispute.status as keyof typeof statusConfig] || statusConfig.needs_response;
                  const StatusIcon = status.icon;

                  return (
                    <div
                      key={dispute.id}
                      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/disputes/${dispute.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${status.color} bg-opacity-10`}>
                            <StatusIcon className={`h-5 w-5 ${status.color.replace('bg-', 'text-')}`} />
                          </div>
                          <div>
                            <p className="font-medium">
                              Dispute #{dispute.stripeDisputeId.slice(-8)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(dispute.amount / 100, dispute.currency)} • {dispute.reason}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created {formatDate(dispute.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={dispute.status === 'won' ? 'default' : dispute.status === 'lost' ? 'destructive' : 'secondary'}>
                            {status.label}
                          </Badge>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {total > 10 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                disabled={page * 10 >= total}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            About Chargeback Disputes
          </h3>
          <p className="text-sm text-muted-foreground">
            A dispute occurs when a customer questions a payment with their bank. 
            We automatically handle the dispute process and will contact you if any 
            additional information is needed. Most disputes are resolved within 60 days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
