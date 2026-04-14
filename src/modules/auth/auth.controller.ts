import {
  Controller,
  Post,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Request,
  Query,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login (requires verified email)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or email not verified',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'User registration (sends verification email, no tokens)',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Registration successful — check email for verification code',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        user_id: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<{ message: string; user_id: string }> {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with OTP and receive auth tokens',
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({
    status: 200,
    description: 'Email verified, tokens issued',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<AuthResponseDto> {
    return this.authService.verifyEmail(dto.email, dto.token);
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange refresh token for new access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'New tokens issued',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(dto.refresh_token);
  }

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send password recovery email (always returns 200)',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Generic message (does not reveal if email exists)',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP from email' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(
      dto.email,
      dto.token,
      dto.new_password,
    );
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        full_name: { type: 'string' },
        phone: { type: 'string' },
        role: { type: 'string' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({
    status: 400,
    description: 'At least one field is required',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @Get('me/profile-summary')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get profile + activity stats (US-005 placeholder)',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary with profile and zeroed stats',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfileSummary(@Request() req: any) {
    return this.authService.getProfileSummary(req.user.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout (client discards token)' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(): Promise<{ message: string }> {
    return { message: 'Logout successful' };
  }

  @Get('/admin/users')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin required' })
  async getAllUsers(
    @Query() pagination: PaginationDto,
    @Request() req: any,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return this.authService.getAllUsers(pagination);
  }
}
