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

type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  createdAt: string;
  customerEmail: string;
}

interface PaymentsTableProps {
  payments: Payment[];
  onRefund?: (paymentId: string) => void;
  onViewDetails?: (paymentId: string) => void;
}

const statusStyles: Record<PaymentStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  succeeded: { variant: 'default', className: 'bg-success/10 text-success border-success/20' },
  pending: { variant: 'secondary', className: 'bg-warning/10 text-warning border-warning/20' },
  failed: { variant: 'destructive', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  refunded: { variant: 'outline', className: 'bg-muted text-muted-foreground' },
};

type SortField = 'createdAt' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

export function PaymentsTable({ payments, onRefund, onViewDetails }: PaymentsTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredPayments = payments
    .filter((payment) => statusFilter === 'all' || payment.status === statusFilter)
    .sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'amount') {
        return multiplier * (a.amount - b.amount);
      }
      if (sortField === 'status') {
        return multiplier * a.status.localeCompare(b.status);
      }
      return multiplier * new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {(['all', 'succeeded', 'pending', 'failed', 'refunded'] as const).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status)}
            className="capitalize"
          >
            {status}
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
                  Date
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
              <TableHead>Description</TableHead>
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
            {filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No payments found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {formatDate(payment.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {payment.customerEmail}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {payment.description || '—'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(payment.amount, payment.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusStyles[payment.status].variant}
                      className={cn('capitalize', statusStyles[payment.status].className)}
                    >
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Payment actions"
                        >
                          <DotsThreeIcon className="h-4 w-4" weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails?.(payment.id)}>
                          View Details
                        </DropdownMenuItem>
                        {payment.status === 'succeeded' && (
                          <DropdownMenuItem
                            onClick={() => onRefund?.(payment.id)}
                            className="text-destructive"
                          >
                            Refund
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