import { IsInt, IsString, IsOptional, Min, IsIn } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @Min(50) // Minimum 50 cents
  amount: number; // in cents

  @IsString()
  @IsIn(['usd', 'eur', 'gbp'])
  currency: string = 'usd';

  @IsOptional()
  @IsString()
  paymentMethodId?: string; // If not provided, uses default

  @IsOptional()
  @IsString()
  description?: string;
}
