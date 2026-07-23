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

interface SupabaseError {
  message: string;
}

interface SupabaseSingleResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface SupabaseListResult<T> {
  data: T[] | null;
  error: SupabaseError | null;
  count: number | null;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

type ProfileUpdate = Partial<Pick<ProfileRow, 'full_name' | 'phone'>>;

export interface ProfileSummary {
  profile: ProfileRow;
  stats: {
    places_visited: number;
    places_saved: number;
    reviews: number;
    badges: string[];
  };
}

export interface PaginatedUsers {
  data: ProfileRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuthService {
  constructor(
    // Cliente de datos (service role) — para todas las queries `.from(...)`.
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    // Cliente separado solo para auth, para no contaminar el de datos.
    @Inject('SUPABASE_AUTH_CLIENT')
    private readonly supabaseAuth: SupabaseClient,
  ) {}

  /**
   * Login con email + password.
   * Bloquea si el email no fue verificado (US-001 estricto).
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const { data, error } = await this.supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    // Supabase puede devolver error con mensajes que mencionan "email not confirmed"
    if (error) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('confirm') || msg.includes('not confirmed')) {
        throw new UnauthorizedException(
          'Email no verificado. Revisa tu bandeja de entrada.',
        );
      }
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    if (!data.user) {
      throw new UnauthorizedException('No se pudo autenticar');
    }

    // Doble check defensivo: si el user existe pero no está confirmado
    if (!data.user.email_confirmed_at) {
      throw new UnauthorizedException(
        'Email no verificado. Revisa tu bandeja de entrada.',
      );
    }

    const profile = await this.fetchProfile(data.user.id);
    return this.buildAuthResponse(data.user.id, data.user.email!, profile);
  }

  /**
   * Registro estricto: NO devuelve tokens. El usuario debe verificar su email
   * antes de poder iniciar sesión.
   */
  async register(
    registerDto: RegisterDto,
  ): Promise<{ message: string; user_id: string }> {
    const { email, password, full_name, phone } = registerDto;

    const { data, error } = await this.supabaseAuth.auth.signUp({
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
      throw new BadRequestException('No se pudo completar el registro');
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
    const { error: roleError } = await this.supabase.from('user_roles').insert({
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
  async verifyEmail(email: string, token: string): Promise<AuthResponseDto> {
    const { data, error } = await this.supabaseAuth.auth.verifyOtp({
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
    return this.buildAuthResponse(data.user.id, data.user.email!, profile);
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
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    if (decoded.type !== 'refresh' || !decoded.sub) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const userId = decoded.sub;
    const profile = await this.fetchProfile(userId);
    if (!profile) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Necesitamos el email del auth.users para devolverlo en el response
    const { data: userData } =
      await this.supabaseAuth.auth.admin.getUserById(userId);
    const email = userData?.user?.email || profile.email || '';

    return this.buildAuthResponse(userId, email, profile);
  }

  /**
   * Actualiza full_name y/o phone del usuario actual.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileRow> {
    if (!dto.full_name && !dto.phone) {
      throw new BadRequestException(
        'Debes enviar al menos un campo (nombre o teléfono)',
      );
    }

    const updates: ProfileUpdate = {};
    if (dto.full_name !== undefined) updates.full_name = dto.full_name;
    if (dto.phone !== undefined) updates.phone = dto.phone;

    const { data, error } = (await this.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, email, full_name, phone, role, created_at, updated_at')
      .single()) as unknown as SupabaseSingleResult<ProfileRow>;

    if (error || !data) {
      throw new NotFoundException('Perfil no encontrado');
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
      await this.supabaseAuth.auth.resetPasswordForEmail(email, { redirectTo });
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
    const { data, error } = await this.supabaseAuth.auth.verifyOtp({
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
      await this.supabaseAuth.auth.admin.updateUserById(data.user.id, {
        password: newPassword,
      });

    if (updateError) {
      throw new BadRequestException(updateError.message);
    }

    return { message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Devuelve el perfil del usuario autenticado (US-005 — versión completa).
   */
  async getProfile(userId: string): Promise<ProfileRow> {
    const profile = await this.fetchProfile(userId);
    if (!profile) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return profile;
  }

  /**
   * Devuelve el perfil envuelto en un summary con stats placeholder.
   * TODO(US-005): reemplazar stats hardcoded cuando existan los módulos
   * places, reviews y gamification.
   */
  async getProfileSummary(userId: string): Promise<ProfileSummary> {
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
  logout(userId: string): Promise<void> {
    console.log(`User ${userId} logged out`);
    return Promise.resolve();
  }

  async getAllUsers(pagination: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedUsers> {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const { data, error, count } = (await this.supabase
      .from('profiles')
      .select('id, email, full_name, phone, role, created_at, updated_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(
        offset,
        offset + limit - 1,
      )) as unknown as SupabaseListResult<ProfileRow>;

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

  private async fetchProfile(userId: string): Promise<ProfileRow | null> {
    const { data } = (await this.supabase
      .from('profiles')
      .select('id, email, full_name, phone, role, created_at, updated_at')
      .eq('id', userId)
      .single()) as unknown as SupabaseSingleResult<ProfileRow>;
    return data;
  }

  private buildAuthResponse(
    userId: string,
    email: string,
    profile: ProfileRow | null,
  ): AuthResponseDto {
    const role = profile?.role || 'user';
    return {
      user: {
        id: userId,
        email,
        full_name: profile?.full_name ?? undefined,
        phone: profile?.phone ?? undefined,
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
