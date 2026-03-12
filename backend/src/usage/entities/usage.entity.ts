export class UsageEntity {
  id: string;
  period: string;
  amount: number;
  usageCount: number;
  description?: string;
  billed: boolean;
  paymentId?: string;
  createdAt: Date;
}
