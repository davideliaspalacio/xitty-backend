import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { CreatePreferencesDto } from './dto/create-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PreferencesResponseDto } from './dto/preferences-response.dto';

const TABLE = 'user_preferences';

@Injectable()
export class PreferencesService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Crea o actualiza las preferencias del usuario y marca wizard_completed=true.
   */
  async upsert(
    userId: string,
    dto: CreatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    if (dto.budget_max < dto.budget_min) {
      throw new BadRequestException(
        'budget_max must be greater than or equal to budget_min',
      );
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          traveler_type: dto.traveler_type,
          budget_min: dto.budget_min,
          budget_max: dto.budget_max,
          available_time: dto.available_time,
          energy_level: dto.energy_level,
          companions: dto.companions,
          wizard_completed: true,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message || 'Could not save preferences',
      );
    }

    return data as PreferencesResponseDto;
  }

  /**
   * Devuelve las preferencias del usuario. Si no existen, devuelve un objeto
   * default con wizard_completed=false (para que el frontend sepa el estado).
   */
  async getByUserId(userId: string): Promise<PreferencesResponseDto> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!data) {
      return {
        user_id: userId,
        traveler_type: null,
        budget_min: null,
        budget_max: null,
        available_time: null,
        energy_level: null,
        companions: 0,
        wizard_completed: false,
      };
    }

    return data as PreferencesResponseDto;
  }

  /**
   * Update parcial. Falla si el row no existe.
   */
  async update(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    if (
      dto.budget_min !== undefined &&
      dto.budget_max !== undefined &&
      dto.budget_max < dto.budget_min
    ) {
      throw new BadRequestException(
        'budget_max must be greater than or equal to budget_min',
      );
    }

    const updates: Record<string, any> = {};
    for (const key of [
      'traveler_type',
      'budget_min',
      'budget_max',
      'available_time',
      'energy_level',
      'companions',
    ] as const) {
      if (dto[key] !== undefined) updates[key] = dto[key];
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .update(updates)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !data) {
      throw new NotFoundException(
        'Preferences not found. Create them first via POST /preferences.',
      );
    }

    return data as PreferencesResponseDto;
  }

  /**
   * Crea un row vacío con wizard_completed=false (idempotente).
   */
  async skip(userId: string): Promise<PreferencesResponseDto> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          wizard_completed: false,
        },
        { onConflict: 'user_id', ignoreDuplicates: false },
      )
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message || 'Could not skip wizard',
      );
    }

    return data as PreferencesResponseDto;
  }
}
