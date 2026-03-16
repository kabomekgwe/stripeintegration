import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserEntity } from '../users/entities/user.entity';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: UserEntity; accessToken: string }> {
    try {
      const user = await this.usersService.create({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        country: registerDto.country,
      });

      const accessToken = await this.generateToken(user);
      await this.redisService.setSession(accessToken, user.id);

      // Send welcome email
      await this.mailService.sendWelcome(
        user.email,
        user.name || user.email,
        process.env.FRONTEND_URL || 'http://localhost:3000',
      );

      return { user, accessToken };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Registration failed');
    }
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: UserEntity; accessToken: string }> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      user,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.generateToken(user);
    await this.redisService.setSession(accessToken, user.id);

    return { user, accessToken };
  }

  async logout(token: string): Promise<void> {
    await this.redisService.deleteSession(token);
  }

  async validateToken(token: string): Promise<UserEntity | null> {
    const userId = await this.redisService.getSession(token);
    if (!userId) return null;

    return this.usersService.findById(userId);
  }

  private async generateToken(user: UserEntity): Promise<string> {
    const payload = { sub: user.id, email: user.email };
    return this.jwtService.signAsync(payload);
  }

  // ==================== PASSWORD RESET ====================

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    
    // Don't reveal if email exists (security best practice)
    if (!user) {
      return;
    }

    // Generate reset token using cryptographically secure random bytes
    const resetToken = randomBytes(32).toString('hex');
    const key = `password_reset:${resetToken}`;
    
    // Store in Redis with 1 hour expiration
    await this.redisService.set(key, user.id, 3600);

    // Send email
    await this.mailService.sendPasswordReset(
      user.email,
      resetToken,
      user.name || user.email,
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const key = `password_reset:${dto.token}`;
    const userId = await this.redisService.get(key);

    if (!userId) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Update user password
    await this.usersService.updatePassword(userId, hashedPassword);

    // Delete reset token
    await this.redisService.del(key);

    // Invalidate all existing sessions for security
    await this.redisService.deletePattern(`session:*`);
  }
}
