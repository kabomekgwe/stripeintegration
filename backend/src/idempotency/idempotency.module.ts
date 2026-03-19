import { Module, Global } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyGuard } from './idempotency.guard';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@Global()
@Module({
  providers: [IdempotencyService, IdempotencyGuard, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyGuard, IdempotencyInterceptor],
})
export class IdempotencyModule {}
