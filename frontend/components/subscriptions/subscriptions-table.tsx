'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DotsThreeIcon, ArrowUpIcon, ArrowDownIcon } from '@phosphor-icons/react';

type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';

interface Subscription {
  id: string;
  status: SubscriptionStatus;
  planName: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  currentPeriodEnd: string;
  createdAt: string;
  customerEmail: string;
}

interface SubscriptionsTableProps {
  subscriptions: Subscription[];
  onCancel?: (subscriptionId: string) => void;
  onViewDetails?: (subscriptionId: string) => void;
}

const statusStyles: Record<SubscriptionStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  active: { variant: 'default', className: 'bg-success/10 text-success border-success/20' },
  trialing: { variant: 'secondary', className: 'bg-primary/10 text-primary border-primary/20' },
  past_due: { variant: 'destructive', className: 'bg-warning/10 text-warning border-warning/20' },
  canceled: { variant: 'outline', className: 'bg-muted text-muted-foreground' },
  incomplete: { variant: 'secondary', className: 'bg-muted-foreground/10 text-muted-foreground' },
};

type SortField = 'currentPeriodEnd' | 'amount' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export function SubscriptionsTable({ subscriptions, onCancel, onViewDetails }: SubscriptionsTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredSubscriptions = subscriptions
    .filter((sub) => statusFilter === 'all' || sub.status === statusFilter)
    .sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'amount') {
        return multiplier * (a.amount - b.amount);
      }
      if (sortField === 'status') {
        return multiplier * a.status.localeCompare(b.status);
      }
      if (sortField === 'currentPeriodEnd') {
        return multiplier * (new Date(a.currentPeriodEnd).getTime() - new Date(b.currentPeriodEnd).getTime());
      }
      return multiplier * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRenewalText = (dateString: string, status: SubscriptionStatus) => {
    if (status === 'canceled') return 'Canceled';
    if (status === 'past_due') return 'Past due';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Renews today';
    if (diffDays <= 7) return `Renews in ${diffDays} days`;
    return `Renews ${formatDate(dateString)}`;
  };

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {(['all', 'active', 'trialing', 'past_due', 'canceled', 'incomplete'] as const).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status)}
            className="capitalize"
          >
            {status.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-1">
                  Created
                  {sortField === 'createdAt' && (
                    sortDirection === 'asc' ? (
                      <ArrowUpIcon className="h-4 w-4" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4" />
                    )
                  )}
                </div>
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center gap-1">
                  Amount
                  {sortField === 'amount' && (
                    sortDirection === 'asc' ? (
                      <ArrowUpIcon className="h-4 w-4" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4" />
                    )
                  )}
                </div>
              </TableHead>
              <TableHead>Interval</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('currentPeriodEnd')}
              >
                <div className="flex items-center gap-1">
                  Renewal
                  {sortField === 'currentPeriodEnd' && (
                    sortDirection === 'asc' ? (
                      <ArrowUpIcon className="h-4 w-4" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4" />
                    )
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  {sortField === 'status' && (
                    sortDirection === 'asc' ? (
                      <ArrowUpIcon className="h-4 w-4" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4" />
                    )
                  )}
                </div>
              </TableHead>
              <TableHead className="w-[50px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No subscriptions found.
                </TableCell>
              </TableRow>
            ) : (
              filteredSubscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell className="font-medium">
                    {formatDate(subscription.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {subscription.customerEmail}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{subscription.planName}</span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(subscription.amount, subscription.currency)}
                  </TableCell>
                  <TableCell className="capitalize">
                    {subscription.interval}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      subscription.status === 'canceled' && 'text-muted-foreground',
                      subscription.status === 'past_due' && 'text-warning'
                    )}>
                      {getRenewalText(subscription.currentPeriodEnd, subscription.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusStyles[subscription.status].variant}
                      className={cn('capitalize', statusStyles[subscription.status].className)}
                    >
                      {subscription.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Subscription actions"
                        >
                          <DotsThreeIcon className="h-4 w-4" weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails?.(subscription.id)}>
                          View Details
                        </DropdownMenuItem>
                        {subscription.status === 'active' && (
                          <DropdownMenuItem
                            onClick={() => onCancel?.(subscription.id)}
                            className="text-destructive"
                          >
                            Cancel Subscription
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}