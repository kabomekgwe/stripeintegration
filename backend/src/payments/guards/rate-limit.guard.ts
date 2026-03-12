import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class PaymentRateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      return true;
    }

    const key = `rate_limit:payment:${userId}`;
    const result = await this.redisService.checkRateLimit(key, 10, 60); // 10 per minute

    if (!result.allowed) {
      throw new HttpException(
        {
          message: 'Rate limit exceeded. Please try again later.',
          resetTime: result.resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
