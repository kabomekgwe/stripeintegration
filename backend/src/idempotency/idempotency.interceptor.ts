import {
  Injectable,
  Inject,
  Optional,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject('IDEMPOTENCY_SERVICE')
    private idempotencyService?: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.idempotencyService) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const idempotencyKey = (request as any).idempotencyKey;
    const userId = (request as any).user?.id;

    if (!idempotencyKey) {
      return next.handle();
    }

    const originalJson = response.json.bind(response);
    const originalSend = response.send.bind(response);

    response.json = function (body: unknown) {
      return originalJson(body);
    };

    const saveResponse = async (statusCode: number, body: unknown) => {
      if (this.idempotencyService && idempotencyKey) {
        if (statusCode >= 200 && statusCode < 300) {
          await this.idempotencyService.markCompleted(
            idempotencyKey,
            { statusCode, body },
            userId,
          );
        } else if (statusCode >= 400) {
          await this.idempotencyService.markFailed(
            idempotencyKey,
            `HTTP ${statusCode}`,
            userId,
          );
        }
      }
    };

    return next.handle().pipe(
      tap(async (data) => {
        await saveResponse(response.statusCode, data);
      }),
      catchError(async (error) => {
        if (this.idempotencyService && idempotencyKey) {
          await this.idempotencyService.markFailed(
            idempotencyKey,
            error.message || 'Unknown error',
            userId,
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
