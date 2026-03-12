import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [StripeModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
