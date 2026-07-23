import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import { GrantConsentDto, ConsentType } from './dto/grant-consent.dto';
import { ConsentResponseDto } from './dto/consent-response.dto';

const TABLE = 'user_consents';

const VALID_CONSENT_TYPES: ConsentType[] = [
  ConsentType.LOCATION_TRACKING,
  ConsentType.CHAT_ANALYTICS,
  ConsentType.MARKETING,
];

interface SupabaseError {
  message: string;
}

interface SupabaseResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

@Injectable()
export class ConsentsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Otorga un consentimiento: crea/actualiza el row con granted=true
   * y revoked_at=null.
   */
  async grant(
    userId: string,
    dto: GrantConsentDto,
  ): Promise<ConsentResponseDto> {
    if (!VALID_CONSENT_TYPES.includes(dto.consent_type)) {
      throw new BadRequestException(
        `Invalid consent_type. Must be one of: ${VALID_CONSENT_TYPES.join(', ')}`,
      );
    }

    const now = new Date().toISOString();

    const { data, error } = (await this.supabase
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          consent_type: dto.consent_type,
          granted: true,
          granted_at: now,
          revoked_at: null,
        },
        { onConflict: 'user_id,consent_type' },
      )
      .select('*')
      .single()) as unknown as SupabaseResult<ConsentResponseDto>;

    if (error || !data) {
      throw new BadRequestException(
        error?.message || 'Could not grant consent',
      );
    }

    return data;
  }

  /**
   * Revoca un consentimiento: setea granted=false y revoked_at=now.
   * Idempotente — si el row no existe lo crea ya revocado.
   */
  async revoke(
    userId: string,
    consentType: ConsentType,
  ): Promise<ConsentResponseDto> {
    if (!VALID_CONSENT_TYPES.includes(consentType)) {
      throw new BadRequestException(
        `Invalid consent_type. Must be one of: ${VALID_CONSENT_TYPES.join(', ')}`,
      );
    }

    const now = new Date().toISOString();

    // OJO: NO incluir granted_at en el upsert. Si lo pusiéramos, al revocar un
    // consent existente sobrescribiríamos la fecha original de otorgamiento con
    // la de revocación, perdiendo el rastro de auditoría que exige la Ley 1581.
    // Al omitirlo: en UPDATE (conflict) se preserva el granted_at original; en
    // INSERT nuevo (revoke idempotente) toma el DEFAULT now() de la columna.
    const { data, error } = (await this.supabase
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          consent_type: consentType,
          granted: false,
          revoked_at: now,
        },
        { onConflict: 'user_id,consent_type' },
      )
      .select('*')
      .single()) as unknown as SupabaseResult<ConsentResponseDto>;

    if (error || !data) {
      throw new BadRequestException(
        error?.message || 'Could not revoke consent',
      );
    }

    return data;
  }

  /**
   * Devuelve todos los consents del usuario (granted o revoked).
   * El frontend filtra los activos por (granted = true).
   */
  async getByUser(userId: string): Promise<ConsentResponseDto[]> {
    const { data, error } = (await this.supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('granted_at', { ascending: false })) as unknown as SupabaseResult<
      ConsentResponseDto[]
    >;

    if (error) {
      throwDbError(error, 'ConsentsService');
    }

    return data || [];
  }
}
