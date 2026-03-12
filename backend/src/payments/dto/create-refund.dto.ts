import { IsString, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  paymentIntentId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number; // If not provided, full refund

  @IsOptional()
  @IsString()
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other';

  @IsOptional()
  @IsString()
  description?: string;
}
