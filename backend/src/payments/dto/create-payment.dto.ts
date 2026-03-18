import { IsInt, IsString, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  line1: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  postal_code: string;

  @IsString()
  country: string;
}

class CustomerDetailsDto {
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsOptional()
  @IsString()
  name?: string;
}

export class CreatePaymentDto {
  @IsInt()
  @Min(50) // Minimum 50 cents
  amount: number; // in cents

  @IsString()
  currency: string = 'gbp';

  @IsOptional()
  @IsString()
  paymentMethodId?: string; // If not provided, uses default

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDetailsDto)
  customerDetails?: CustomerDetailsDto;

  @IsOptional()
  @IsString()
  countryCode?: string;
}
