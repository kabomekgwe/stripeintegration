import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Skip API key check for Stripe webhooks (they use signature verification)
    if (request.path === '/stripe/webhook') {
      return true;
    }

    const apiKey = request.headers['x-api-key'];
    const expectedApiKey = this.configService.get<string>('API_KEY');

    if (!expectedApiKey) {
      throw new UnauthorizedException('API key not configured');
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
