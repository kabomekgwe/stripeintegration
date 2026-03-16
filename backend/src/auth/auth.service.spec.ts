import { Test } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { createUserFactory } from '../../test/factories/user.factory';
import { createMockRedisService } from '../../test/mocks/redis.mock';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password-string'),
  compare: vi.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let redisService: RedisService;
  let mailService: MailService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: vi.fn(),
            findByEmail: vi.fn(),
            findById: vi.fn(),
            validatePassword: vi.fn(),
            updatePassword: vi.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: vi.fn().mockResolvedValue('mock-jwt-token'),
          },
        },
        {
          provide: RedisService,
          useValue: createMockRedisService(),
        },
        {
          provide: MailService,
          useValue: {
            sendWelcome: vi.fn().mockResolvedValue(undefined),
            sendPasswordReset: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
    usersService = moduleRef.get<UsersService>(UsersService);
    jwtService = moduleRef.get<JwtService>(JwtService);
    redisService = moduleRef.get<RedisService>(RedisService);
    mailService = moduleRef.get<MailService>(MailService);

    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should create user and return user with access token', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        country: 'US',
      };
      const mockUser = createUserFactory({
        email: registerDto.email,
        name: registerDto.name,
        country: registerDto.country,
      });

      vi.mocked(usersService.create).mockResolvedValue(mockUser);
      vi.mocked(jwtService.signAsync).mockResolvedValue('mock-jwt-token');

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(usersService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        country: registerDto.country,
      });
    });

    it('should throw ConflictException if email exists', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
        country: 'US',
      };

      vi.mocked(usersService.create).mockRejectedValue(
        new ConflictException('Email already registered'),
      );

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(usersService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        country: registerDto.country,
      });
    });

    it('should call mailService.sendWelcome after successful registration', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        country: 'US',
      };
      const mockUser = createUserFactory({
        email: registerDto.email,
        name: registerDto.name,
      });

      vi.mocked(usersService.create).mockResolvedValue(mockUser);
      vi.mocked(jwtService.signAsync).mockResolvedValue('mock-jwt-token');

      // Act
      await authService.register(registerDto);

      // Assert
      expect(mailService.sendWelcome).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        expect.any(String),
      );
    });

    it('should store session in Redis after registration', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        country: 'US',
      };
      const mockUser = createUserFactory({
        email: registerDto.email,
        name: registerDto.name,
      });

      vi.mocked(usersService.create).mockResolvedValue(mockUser);
      vi.mocked(jwtService.signAsync).mockResolvedValue('mock-jwt-token');

      // Act
      await authService.register(registerDto);

      // Assert
      expect(redisService.setSession).toHaveBeenCalledWith(
        'mock-jwt-token',
        mockUser.id,
      );
    });

    it('should throw generic error for unexpected failures', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        country: 'US',
      };

      vi.mocked(usersService.create).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(authService.register(registerDto)).rejects.toThrow(
        'Registration failed',
      );
    });
  });

  describe('login', () => {
    it('should return user and token for valid credentials', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const mockUser = createUserFactory({ email: loginDto.email });

      vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      vi.mocked(jwtService.signAsync).mockResolvedValue('mock-jwt-token');

      // Act
      const result = await authService.login(loginDto);

      // Assert
      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(usersService.validatePassword).toHaveBeenCalledWith(
        mockUser,
        loginDto.password,
      );
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      vi.mocked(usersService.findByEmail).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };
      const mockUser = createUserFactory({ email: loginDto.email });

      vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(usersService.validatePassword).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.validatePassword).toHaveBeenCalledWith(
        mockUser,
        loginDto.password,
      );
    });

    it('should store session in Redis after successful login', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const mockUser = createUserFactory({ email: loginDto.email });

      vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(usersService.validatePassword).mockResolvedValue(true);
      vi.mocked(jwtService.signAsync).mockResolvedValue('mock-jwt-token');

      // Act
      await authService.login(loginDto);

      // Assert
      expect(redisService.setSession).toHaveBeenCalledWith(
        'mock-jwt-token',
        mockUser.id,
      );
    });
  });

  describe('logout', () => {
    it('should delete session from Redis', async () => {
      // Arrange
      const token = 'mock-jwt-token';

      // Act
      await authService.logout(token);

      // Assert
      expect(redisService.deleteSession).toHaveBeenCalledWith(token);
    });
  });

  describe('validateToken', () => {
    it('should return user for valid session', async () => {
      // Arrange
      const token = 'valid-jwt-token';
      const mockUser = createUserFactory();

      vi.mocked(redisService.getSession).mockResolvedValue(mockUser.id);
      vi.mocked(usersService.findById).mockResolvedValue(mockUser);

      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toEqual(mockUser);
      expect(redisService.getSession).toHaveBeenCalledWith(token);
      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return null for invalid session', async () => {
      // Arrange
      const token = 'invalid-jwt-token';

      vi.mocked(redisService.getSession).mockResolvedValue(null);

      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toBeNull();
      expect(redisService.getSession).toHaveBeenCalledWith(token);
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('should return null if user not found', async () => {
      // Arrange
      const token = 'valid-jwt-token';
      const userId = 'non-existent-user-id';

      vi.mocked(redisService.getSession).mockResolvedValue(userId);
      vi.mocked(usersService.findById).mockResolvedValue(null);

      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).toBeNull();
      expect(usersService.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate reset token and store in Redis', async () => {
      // Arrange
      const dto: ForgotPasswordDto = { email: 'test@example.com' };
      const mockUser = createUserFactory({ email: dto.email });

      vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(redisService.set).mockResolvedValue(undefined);
      vi.mocked(mailService.sendPasswordReset).mockResolvedValue(undefined);

      // Act
      await authService.requestPasswordReset(dto);

      // Assert
      expect(usersService.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^password_reset:/),
        mockUser.id,
        3600,
      );
    });

    it('should send password reset email', async () => {
      // Arrange
      const dto: ForgotPasswordDto = { email: 'test@example.com' };
      const mockUser = createUserFactory({ email: dto.email });

      vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);

      // Act
      await authService.requestPasswordReset(dto);

      // Assert
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(String),
        mockUser.name,
      );
    });

    it('should not throw if user not found (security)', async () => {
      // Arrange
      const dto: ForgotPasswordDto = { email: 'nonexistent@example.com' };

      vi.mocked(usersService.findByEmail).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.requestPasswordReset(dto)).resolves.not.toThrow();
      expect(usersService.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(redisService.set).not.toHaveBeenCalled();
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('should generate token with correct format', async () => {
      // Arrange
      const dto: ForgotPasswordDto = { email: 'test@example.com' };
      const mockUser = createUserFactory({ email: dto.email });

      vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser);

      // Act
      await authService.requestPasswordReset(dto);

      // Assert
      const setCall = vi.mocked(redisService.set).mock.calls[0];
      const key = setCall[0] as string;
      // Token should be password_reset: prefix followed by token
      expect(key).toMatch(/^password_reset:/);
      // Token portion should be non-empty
      const token = key.replace('password_reset:', '');
      expect(token.length).toBeGreaterThan(20);
    });
  });

  describe('resetPassword', () => {
    it('should update password for valid token', async () => {
      // Arrange
      const dto: ResetPasswordDto = {
        token: 'valid-reset-token',
        newPassword: 'newpassword123',
      };
      const userId = 'user-id-123';

      vi.mocked(redisService.get).mockResolvedValue(userId);
      vi.mocked(usersService.updatePassword).mockResolvedValue(undefined);
      vi.mocked(redisService.del).mockResolvedValue(undefined);
      vi.mocked(redisService.deletePattern).mockResolvedValue(undefined);

      // Act
      await authService.resetPassword(dto);

      // Assert
      expect(redisService.get).toHaveBeenCalledWith(`password_reset:${dto.token}`);
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        userId,
        expect.any(String),
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      // Arrange
      const dto: ResetPasswordDto = {
        token: 'invalid-reset-token',
        newPassword: 'newpassword123',
      };

      vi.mocked(redisService.get).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.resetPassword(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redisService.get).toHaveBeenCalledWith(`password_reset:${dto.token}`);
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('should delete reset token after use', async () => {
      // Arrange
      const dto: ResetPasswordDto = {
        token: 'valid-reset-token',
        newPassword: 'newpassword123',
      };
      const userId = 'user-id-123';

      vi.mocked(redisService.get).mockResolvedValue(userId);
      vi.mocked(usersService.updatePassword).mockResolvedValue(undefined);

      // Act
      await authService.resetPassword(dto);

      // Assert
      expect(redisService.del).toHaveBeenCalledWith(`password_reset:${dto.token}`);
    });

    it('should invalidate all sessions after password reset', async () => {
      // Arrange
      const dto: ResetPasswordDto = {
        token: 'valid-reset-token',
        newPassword: 'newpassword123',
      };
      const userId = 'user-id-123';

      vi.mocked(redisService.get).mockResolvedValue(userId);
      vi.mocked(usersService.updatePassword).mockResolvedValue(undefined);

      // Act
      await authService.resetPassword(dto);

      // Assert
      expect(redisService.deletePattern).toHaveBeenCalledWith('session:*');
    });

    it('should hash new password before storing', async () => {
      // Arrange
      const dto: ResetPasswordDto = {
        token: 'valid-reset-token',
        newPassword: 'newpassword123',
      };
      const userId = 'user-id-123';

      vi.mocked(redisService.get).mockResolvedValue(userId);
      vi.mocked(usersService.updatePassword).mockResolvedValue(undefined);

      // Act
      await authService.resetPassword(dto);

      // Assert
      const updateCall = vi.mocked(usersService.updatePassword).mock.calls[0];
      const hashedPassword = updateCall[1] as string;
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(dto.newPassword);
      expect(hashedPassword.length).toBeGreaterThan(20);
    });
  });
});
