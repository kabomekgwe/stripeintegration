import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { StripeModule } from '../stripe/stripe.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [StripeModule, CacheModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
