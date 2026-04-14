import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Login con email + password.
   * Bloquea si el email no fue verificado (US-001 estricto).
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Supabase puede devolver error con mensajes que mencionan "email not confirmed"
    if (error) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('confirm') || msg.includes('not confirmed')) {
        throw new UnauthorizedException(
          'Email not verified. Please check your inbox.',
        );
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!data.user) {
      throw new UnauthorizedException('Authentication failed');
    }

    // Doble check defensivo: si el user existe pero no está confirmado
    if (!data.user.email_confirmed_at) {
      throw new UnauthorizedException(
        'Email not verified. Please check your inbox.',
      );
    }

    const profile = await this.fetchProfile(data.user.id);
    return this.buildAuthResponse(
      data.user.id,
      data.user.email!,
      profile,
    );
  }

  /**
   * Registro estricto: NO devuelve tokens. El usuario debe verificar su email
   * antes de poder iniciar sesión.
   */
  async register(
    registerDto: RegisterDto,
  ): Promise<{ message: string; user_id: string }> {
    const { email, password, full_name, phone } = registerDto;

    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, phone },
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!data.user) {
      throw new BadRequestException('Registration failed');
    }

    // Crear perfil (el trigger SQL rellena el email automáticamente)
    const { error: profileError } = await this.supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        full_name,
        phone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.warn('Error creating profile:', profileError);
    }

    // Asignar rol por defecto en user_roles
    const { error: roleError } = await this.supabase
      .from('user_roles')
      .insert({
        user_id: data.user.id,
        role: 'user',
        created_at: new Date().toISOString(),
      });

    if (roleError) {
      console.warn('Error assigning role:', roleError);
    }

    return {
      message:
        'Verifica tu email para activar tu cuenta. Te enviamos un código de 6 dígitos.',
      user_id: data.user.id,
    };
  }

  /**
   * Verifica el email con el OTP que llegó al correo y devuelve los tokens.
   */
  async verifyEmail(
    email: string,
    token: string,
  ): Promise<AuthResponseDto> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (error || !data.user) {
      throw new BadRequestException(
        error?.message || 'Token de verificación inválido o expirado',
      );
    }

    const profile = await this.fetchProfile(data.user.id);
    return this.buildAuthResponse(
      data.user.id,
      data.user.email!,
      profile,
    );
  }

  /**
   * Canjea un refresh_token por un nuevo par de tokens.
   */
  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    let decoded: jwt.JwtPayload;
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }
      decoded = jwt.verify(refreshToken, jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (decoded.type !== 'refresh' || !decoded.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = decoded.sub;
    const profile = await this.fetchProfile(userId);
    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    // Necesitamos el email del auth.users para devolverlo en el response
    const { data: userData } = await this.supabase.auth.admin.getUserById(
      userId,
    );
    const email = userData?.user?.email || profile.email || '';

    return this.buildAuthResponse(userId, email, profile);
  }

  /**
   * Actualiza full_name y/o phone del usuario actual.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (!dto.full_name && !dto.phone) {
      throw new BadRequestException(
        'At least one field (full_name or phone) is required',
      );
    }

    const updates: Record<string, any> = {};
    if (dto.full_name !== undefined) updates.full_name = dto.full_name;
    if (dto.phone !== undefined) updates.phone = dto.phone;

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, email, full_name, phone, role, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new NotFoundException('Profile not found');
    }

    return data;
  }

  /**
   * Dispara el email de recovery. Siempre devuelve 200 con mensaje genérico
   * para no revelar si el email existe o no.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const redirectTo =
      (process.env.FRONTEND_URL || 'http://localhost:3000') +
      '/auth/reset-password';

    try {
      await this.supabase.auth.resetPasswordForEmail(email, { redirectTo });
    } catch (err) {
      console.warn('forgotPassword error (silenced):', err);
    }

    return {
      message:
        'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.',
    };
  }

  /**
   * Verifica el OTP de recovery y actualiza la contraseña usando admin.
   */
  async resetPassword(
    email: string,
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const { data, error } = await this.supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });

    if (error || !data.user) {
      throw new BadRequestException(
        error?.message || 'Token de recuperación inválido o expirado',
      );
    }

    const { error: updateError } =
      await this.supabase.auth.admin.updateUserById(data.user.id, {
        password: newPassword,
      });

    if (updateError) {
      throw new BadRequestException(updateError.message);
    }

    return { message: 'Password updated successfully' };
  }

  /**
   * Devuelve el perfil del usuario autenticado (US-005 — versión completa).
   */
  async getProfile(userId: string): Promise<any> {
    const profile = await this.fetchProfile(userId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    return profile;
  }

  /**
   * Devuelve el perfil envuelto en un summary con stats placeholder.
   * TODO(US-005): reemplazar stats hardcoded cuando existan los módulos
   * places, reviews y gamification.
   */
  async getProfileSummary(userId: string) {
    const profile = await this.getProfile(userId);
    return {
      profile,
      stats: {
        places_visited: 0,
        places_saved: 0,
        reviews: 0,
        badges: [] as string[],
      },
    };
  }

  /**
   * Logout (stub — el cliente descarta el token).
   */
  async logout(userId: string): Promise<void> {
    console.log(`User ${userId} logged out`);
  }

  async getAllUsers(pagination: { page?: number; limit?: number }): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from('profiles')
      .select(
        'id, email, full_name, phone, role, created_at, updated_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  private async fetchProfile(userId: string) {
    const { data } = await this.supabase
      .from('profiles')
      .select('id, email, full_name, phone, role, created_at, updated_at')
      .eq('id', userId)
      .single();
    return data;
  }

  private buildAuthResponse(
    userId: string,
    email: string,
    profile: any,
  ): AuthResponseDto {
    const role = profile?.role || 'user';
    return {
      user: {
        id: userId,
        email,
        full_name: profile?.full_name,
        phone: profile?.phone,
        role,
      },
      access_token: this.generateAccessToken(userId, role),
      refresh_token: this.generateRefreshToken(userId),
    };
  }

  private generateAccessToken(userId: string, role: string): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    return jwt.sign(
      {
        sub: userId,
        role,
        type: 'access',
      },
      jwtSecret,
      { expiresIn: '1h' },
    );
  }

  private generateRefreshToken(userId: string): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    return jwt.sign(
      {
        sub: userId,
        type: 'refresh',
      },
      jwtSecret,
      { expiresIn: '7d' },
    );
  }
}
