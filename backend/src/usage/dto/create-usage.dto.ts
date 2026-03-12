import { IsInt, IsString, IsOptional, Min } from 'class-validator';

export class CreateUsageDto {
  @IsInt()
  @Min(0)
  amount: number; // Amount to bill in cents

  @IsInt()
  @Min(0)
  usageCount: number; // Raw usage metric

  @IsOptional()
  @IsString()
  description?: string;
}
