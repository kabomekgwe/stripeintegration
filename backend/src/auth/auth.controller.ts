import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UseGuards,
  Get,
  Request,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        stripeCustomerId: result.user.stripeCustomerId,
      },
      accessToken: result.accessToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        stripeCustomerId: result.user.stripeCustomerId,
      },
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Headers('authorization') auth: string) {
    const token = auth.replace('Bearer ', '');
    await this.authService.logout(token);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const user = req.user;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      stripeCustomerId: user.stripeCustomerId,
      defaultPaymentMethodId: user.defaultPaymentMethodId,
      preferredCurrency: user.preferredCurrency || 'usd',
    };
  }

  // ==================== PASSWORD RESET ====================

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto);
    return { message: 'If email exists, reset link sent' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successful' };
  }

  @Patch('preferred-currency')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updatePreferredCurrency(
    @Request() req,
    @Body('currency') currency: string,
  ) {
    const user = await this.usersService.updatePreferredCurrency(req.user.id, currency);
    return {
      message: 'Currency updated',
      preferredCurrency: user.preferredCurrency,
    };
  }
}
