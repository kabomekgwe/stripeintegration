import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

export class SuspendUserDto {
  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number; // Duration in days
}

export class UnsuspendUserDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}
