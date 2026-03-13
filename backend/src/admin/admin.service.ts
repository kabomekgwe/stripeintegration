import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentStatus, RefundStatus } from '@prisma/client';

export interface DashboardMetrics {
  totalRevenue: number;
  totalRevenueToday: number;
  totalRevenueThisMonth: number;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  totalRefunds: number;
  refundAmount: number;
  activeUsers: number;
  newUsersToday: number;
  averageTransaction: number;
}

export interface RevenueByPeriod {
  period: string;
  revenue: number;
  count: number;
}

export interface PaymentMethodDistribution {
  method: string;
  count: number;
  amount: number;
}

export interface RecentTransaction {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description?: string;
  createdAt: Date;
}

export interface UserListItem {
  id: string;
  email: string;
  name?: string;
  stripeCustomerId?: string;
  createdAt: Date;
  totalPayments: number;
  totalSpent: number;
  lastPaymentAt?: Date;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Total revenue (successful payments only)
    const revenueAgg = await this.prisma.paymentRecord.aggregate({
      where: { status: PaymentStatus.SUCCEEDED },
      _sum: { amount: true },
      _count: { id: true },
    });

    // Today's revenue
    const todayRevenue = await this.prisma.paymentRecord.aggregate({
      where: {
        status: PaymentStatus.SUCCEEDED,
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    });

    // This month's revenue
    const monthRevenue = await this.prisma.paymentRecord.aggregate({
      where: {
        status: PaymentStatus.SUCCEEDED,
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    // Payment counts by status
    const [successfulCount, failedCount, pendingCount] = await Promise.all([
      this.prisma.paymentRecord.count({ where: { status: PaymentStatus.SUCCEEDED } }),
      this.prisma.paymentRecord.count({ where: { status: PaymentStatus.FAILED } }),
      this.prisma.paymentRecord.count({ where: { status: PaymentStatus.PENDING } }),
    ]);

    // Refunds
    const refundAgg = await this.prisma.refund.aggregate({
      where: { status: RefundStatus.SUCCEEDED },
      _sum: { amount: true },
      _count: { id: true },
    });

    // Users
    const [activeUsers, newUsersToday] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
    ]);

    const totalRevenue = revenueAgg._sum.amount || 0;
    const totalPayments = revenueAgg._count.id || 0;

    return {
      totalRevenue,
      totalRevenueToday: todayRevenue._sum.amount || 0,
      totalRevenueThisMonth: monthRevenue._sum.amount || 0,
      totalPayments,
      successfulPayments: successfulCount,
      failedPayments: failedCount,
      pendingPayments: pendingCount,
      totalRefunds: refundAgg._count.id || 0,
      refundAmount: refundAgg._sum.amount || 0,
      activeUsers,
      newUsersToday,
      averageTransaction: totalPayments > 0 ? Math.round(totalRevenue / totalPayments) : 0,
    };
  }

  async getRevenueByPeriod(
    period: 'day' | 'week' | 'month' = 'day',
    days: number = 30,
  ): Promise<RevenueByPeriod[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const payments = await this.prisma.paymentRecord.findMany({
      where: {
        status: PaymentStatus.SUCCEEDED,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by period
    const grouped = new Map<string, { revenue: number; count: number }>();

    for (const payment of payments) {
      const date = new Date(payment.createdAt);
      let key: string;

      if (period === 'day') {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      const current = grouped.get(key) || { revenue: 0, count: 0 };
      grouped.set(key, {
        revenue: current.revenue + payment.amount,
        count: current.count + 1,
      });
    }

    // Fill in missing dates with zero
    const result: RevenueByPeriod[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      let key: string;
      
      if (period === 'day') {
        key = current.toISOString().split('T')[0];
        current.setDate(current.getDate() + 1);
      } else if (period === 'week') {
        const weekStart = new Date(current);
        weekStart.setDate(current.getDate() - current.getDay());
        key = weekStart.toISOString().split('T')[0];
        current.setDate(current.getDate() + 7);
      } else {
        key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        current.setMonth(current.getMonth() + 1);
      }

      const data = grouped.get(key) || { revenue: 0, count: 0 };
      result.push({
        period: key,
        revenue: data.revenue,
        count: data.count,
      });
    }

    return result;
  }

  async getPaymentMethodDistribution(): Promise<PaymentMethodDistribution[]> {
    // Get all payment methods with their IDs
    const allPaymentMethods = await this.prisma.paymentMethod.findMany({
      where: { isActive: true },
      select: { id: true, brand: true },
    });

    const methodIdToBrand = new Map(allPaymentMethods.map(pm => [pm.id, pm.brand || 'Unknown']));

    // Get total amount spent per payment method
    const payments = await this.prisma.paymentRecord.findMany({
      where: { 
        status: PaymentStatus.SUCCEEDED,
        paymentMethodId: { not: null },
      },
      select: {
        amount: true,
        paymentMethodId: true,
      },
    });

    const brandMap = new Map<string, { count: number; amount: number }>();

    // Count active payment methods by brand
    for (const pm of allPaymentMethods) {
      const brand = pm.brand || 'Unknown';
      const current = brandMap.get(brand) || { count: 0, amount: 0 };
      brandMap.set(brand, {
        count: current.count + 1,
        amount: current.amount,
      });
    }

    // Add payment amounts
    for (const payment of payments) {
      if (payment.paymentMethodId) {
        const brand = methodIdToBrand.get(payment.paymentMethodId) || 'Unknown';
        const current = brandMap.get(brand) || { count: 0, amount: 0 };
        brandMap.set(brand, {
          count: current.count,
          amount: current.amount + payment.amount,
        });
      }
    }

    return Array.from(brandMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
    }));
  }

  async getRecentTransactions(limit: number = 20): Promise<RecentTransaction[]> {
    const payments = await this.prisma.paymentRecord.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return payments.map((payment) => ({
      id: payment.id,
      userId: payment.userId,
      userEmail: payment.user.email,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description || undefined,
      createdAt: payment.createdAt,
    }));
  }

  async getUsersList(
    page: number = 1,
    limit: number = 20,
    search?: string,
  ): Promise<{ users: UserListItem[]; total: number }> {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { payments: true },
          },
          payments: {
            where: { status: PaymentStatus.SUCCEEDED },
            select: { amount: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userList: UserListItem[] = users.map((user) => {
      const totalSpent = user.payments.reduce((sum, p) => sum + p.amount, 0);
      
      return {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        stripeCustomerId: user.stripeCustomerId || undefined,
        createdAt: user.createdAt,
        totalPayments: user._count.payments,
        totalSpent,
        lastPaymentAt: user.payments[0]?.createdAt,
      };
    });

    return { users: userList, total };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            refunds: true,
          },
        },
        paymentMethods: {
          where: { isActive: true },
          orderBy: { isDefault: 'desc' },
        },
        usageRecords: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const totalSpent = user.payments
      .filter((p) => p.status === PaymentStatus.SUCCEEDED)
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      ...user,
      totalSpent,
      paymentCount: user.payments.length,
    };
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // TODO: Implement user suspension logic
    return { message: 'User suspended', userId };
  }
}
