import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import {
  SuggestionResponseDto,
  SafetyZoneDto,
  SafetyTone,
  PriceBand,
} from './dto/suggestion-response.dto';

const RPC_NAME = 'suggestions_for';

interface SupabaseError {
  message: string;
}

interface SupabaseRpcResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

@Injectable()
export class SuggestionsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Devuelve sugerencias contextuales para mostrar como badges:
   * safety zone, distancia a playa y banda de precio del área.
   */
  async getContext(lat: number, lng: number): Promise<SuggestionResponseDto> {
    this.validateCoords(lat, lng);

    const { data, error } = (await this.supabase.rpc(RPC_NAME, {
      p_lat: lat,
      p_lng: lng,
    })) as unknown as SupabaseRpcResult<unknown>;

    if (error) {
      throwDbError(error, 'SuggestionsService');
    }

    return this.shape(data);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private validateCoords(lat: number, lng: number): void {
    if (typeof lat !== 'number' || Number.isNaN(lat)) {
      throw new BadRequestException('lat must be a number');
    }
    if (typeof lng !== 'number' || Number.isNaN(lng)) {
      throw new BadRequestException('lng must be a number');
    }
    if (lat < -90 || lat > 90) {
      throw new BadRequestException('lat must be between -90 and 90');
    }
    if (lng < -180 || lng > 180) {
      throw new BadRequestException('lng must be between -180 and 180');
    }
  }

  private shape(raw: unknown): SuggestionResponseDto {
    if (!isRecord(raw)) {
      return { safety_zone: null, nearby_beach_m: null, price_band: null };
    }

    const safetyZone = this.shapeSafetyZone(raw.safety_zone);
    const rawNearbyBeach = raw.nearby_beach_m;
    const nearbyBeach =
      typeof rawNearbyBeach === 'number' && !Number.isNaN(rawNearbyBeach)
        ? rawNearbyBeach
        : null;
    const priceBand = this.shapePriceBand(raw.price_band);

    return {
      safety_zone: safetyZone,
      nearby_beach_m: nearbyBeach,
      price_band: priceBand,
    };
  }

  private shapeSafetyZone(raw: unknown): SafetyZoneDto | null {
    if (!isRecord(raw)) return null;
    const neighborhood = primitiveToString(raw.neighborhood);
    if (!neighborhood) return null;

    const score = Number(raw.score ?? 0);
    const rawTone = raw.tone;
    const tone: SafetyTone =
      rawTone === 'good' || rawTone === 'ok' || rawTone === 'caution'
        ? rawTone
        : this.toneFromScore(score);
    const rawTags = raw.tags;

    return {
      neighborhood,
      score,
      tags: Array.isArray(rawTags)
        ? rawTags.flatMap((tag: unknown) => {
            const value = primitiveToString(tag);
            return value ? [value] : [];
          })
        : [],
      tone,
    };
  }

  private toneFromScore(score: number): SafetyTone {
    if (score >= 70) return 'good';
    if (score >= 50) return 'ok';
    return 'caution';
  }

  private shapePriceBand(raw: unknown): PriceBand | null {
    if (raw === 'asequible' || raw === 'medio' || raw === 'premium') {
      return raw;
    }
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function primitiveToString(value: unknown): string | null {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return null;
}
