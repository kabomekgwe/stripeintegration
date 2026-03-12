import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserEntity } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: UserEntity; accessToken: string }> {
    try {
      const user = await this.usersService.create({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
      });

      const accessToken = await this.generateToken(user);
      await this.redisService.setSession(accessToken, user.id);

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
}
