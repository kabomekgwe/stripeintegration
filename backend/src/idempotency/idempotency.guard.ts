import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Request } from 'express';
import { IdempotencyService, validateIdempotencyKey } from './idempotency.service';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER] as string;

    // Idempotency key is required for POST/PUT/PATCH requests
    const method = request.method.toUpperCase();
    const requiresKey = ['POST', 'PUT', 'PATCH'].includes(method);

    if (requiresKey && !idempotencyKey) {
      throw new BadRequestException(
        'Idempotency-Key header is required for this operation',
      );
    }

    // If no key provided and method doesn't require it, continue
    if (!idempotencyKey) {
      return true;
    }

    // Validate UUID format
    if (!validateIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException(
        'Invalid Idempotency-Key format. Must be a UUID v4.',
      );
    }

    const requestHash = this.idempotencyService.hashPayload(request.body);
    const userId = (request as any).user?.id;

    const { acquired, existing } =
      await this.idempotencyService.acquireLock(idempotencyKey, requestHash, userId);

    if (acquired) {
      (request as any).idempotencyKey = idempotencyKey;
      (request as any).idempotencyAcquired = true;
      return true;
    }

    if (existing?.status === 'completed') {
      const response = existing.response;
      if (response) {
        const httpResponse = context.switchToHttp().getResponse();
        httpResponse.status(response.statusCode);
        httpResponse.setHeader('X-Idempotency-Replay', 'true');
        httpResponse.json(response.body);
        return false;
      }
    }

    if (existing?.status === 'processing') {
      throw new ConflictException(
        'Request is still being processed. Please retry later.',
      );
    }

    if (existing?.status === 'hash_mismatch') {
      throw new UnprocessableEntityException(
        'Idempotency-Key was already used with a different request body.',
      );
    }

    // Failed requests can be retried
    if (existing?.status === 'failed') {
      (request as any).idempotencyKey = idempotencyKey;
      (request as any).idempotencyAcquired = true;
      return true;
    }

    return true;
  }
}
