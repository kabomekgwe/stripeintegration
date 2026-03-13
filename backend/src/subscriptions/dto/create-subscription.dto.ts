import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  priceId: string; // Stripe Price ID or our internal plan ID

  @IsOptional()
  @IsString()
  paymentMethodId?: string; // If not default

  @IsOptional()
  @IsIn(['month', 'year'])
  interval?: 'month' | 'year';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  priceId?: string;

  @IsOptional()
  @IsString()
  cancelAtPeriodEnd?: boolean;
}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsString()
  @IsIn(['immediately', 'period_end'])
  cancelMode?: 'immediately' | 'period_end';

  @IsOptional()
  @IsString()
  reason?: string;
}
