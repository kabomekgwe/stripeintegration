import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

const validCountries = [
  'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'AU', 'JP',
  'MX', 'CH', 'NO', 'SE', 'DK', 'PL', 'CZ', 'HU', 'RO', 'BG',
  'HR', 'RS', 'NZ', 'SG', 'HK', 'KR', 'CN', 'IN', 'TH', 'MY',
  'ID', 'PH', 'VN', 'AE', 'SA', 'IL', 'QA', 'KW', 'BH', 'OM',
  'ZA', 'EG', 'NG', 'KE', 'GH', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY',
];

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(validCountries, { message: 'Invalid country code' })
  country?: string;
}
