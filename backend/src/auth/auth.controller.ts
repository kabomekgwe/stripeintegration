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
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { UsersService } from '../users/users.service';
import { CurrencyService } from '../currency/currency.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly currencyService: CurrencyService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookie(res: Response, token: string) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
  }

  private clearAuthCookie(res: Response) {
    res.clearCookie('access_token', { path: '/' });
  }

  @Post('register')
  @RateLimit(5, 60000) // 5 requests per minute
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User successfully registered, returns user data with auth cookie' })
  @ApiResponse({ status: 400, description: 'Invalid input data or email already exists' })
  @ApiResponse({ status: 429, description: 'Too many registration attempts' })
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(registerDto);
    this.setAuthCookie(res, result.accessToken);
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        stripeCustomerId: result.user.stripeCustomerId,
      },
    };
  }

  @Post('login')
  @RateLimit(5, 60000) // 5 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user and return JWT token via cookie' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'User successfully logged in, returns user data with auth cookie' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    this.setAuthCookie(res, result.accessToken);
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        stripeCustomerId: result.user.stripeCustomerId,
      },
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user and invalidate session' })
  @ApiResponse({ status: 200, description: 'User successfully logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Clear the cookie
    this.clearAuthCookie(res);
    // Also invalidate the session in Redis if needed
    const token = req.cookies?.access_token;
    if (token) {
      await this.authService.logout(token);
    }
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async getProfile(@Request() req) {
    const user = req.user;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      preferredCurrency: user.preferredCurrency || 'usd',
      country: user.country,
      stripeCustomerId: user.stripeCustomerId,
      defaultPaymentMethodId: user.defaultPaymentMethodId,
    };
  }

  // ==================== PASSWORD RESET ====================

  @Post('forgot-password')
  @RateLimit(5, 60000) // 5 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset email sent if account exists' })
  @ApiResponse({ status: 429, description: 'Too many password reset attempts' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto);
    return { message: 'If email exists, reset link sent' };
  }

  @Post('reset-password')
  @RateLimit(5, 60000) // 5 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password successfully reset' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  @ApiResponse({ status: 429, description: 'Too many password reset attempts' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successful' };
  }

  @Patch('preferred-currency')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user preferred currency' })
  @ApiResponse({ status: 200, description: 'Currency updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
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

  @Patch('country')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user country and optionally currency' })
  @ApiResponse({ status: 200, description: 'Country updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async updateCountry(
    @Request() req,
    @Body('country') country: string,
  ) {
    const user = await this.usersService.updateCountry(req.user.id, country);

    // Auto-update currency based on country
    const suggested = this.currencyService.suggestCurrencyForUser(country);
    if (suggested.source === 'country') {
      await this.usersService.updatePreferredCurrency(req.user.id, suggested.currency);
    }

    return {
      message: 'Country updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        country: user.country,
        preferredCurrency: suggested.currency,
      },
      suggestedCurrency: suggested,
    };
  }
}
