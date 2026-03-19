import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_KEY = 'idempotency_key';
export const RequireIdempotencyKey = () => SetMetadata(IDEMPOTENCY_KEY, true);
