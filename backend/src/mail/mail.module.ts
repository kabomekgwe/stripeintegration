import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
