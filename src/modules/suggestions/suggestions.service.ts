import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import {
  SuggestionResponseDto,
  SafetyZoneDto,
  SafetyTone,
  PriceBand,
} from './dto/suggestion-response.dto';

const RPC_NAME = 'suggestions_for';

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

    const { data, error } = await this.supabase.rpc(RPC_NAME, {
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      throw new BadRequestException(error.message);
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

  private shape(raw: any): SuggestionResponseDto {
    if (!raw || typeof raw !== 'object') {
      return { safety_zone: null, nearby_beach_m: null, price_band: null };
    }

    const safetyZone = this.shapeSafetyZone(raw.safety_zone);
    const nearbyBeach =
      typeof raw.nearby_beach_m === 'number' && !Number.isNaN(raw.nearby_beach_m)
        ? raw.nearby_beach_m
        : null;
    const priceBand = this.shapePriceBand(raw.price_band);

    return {
      safety_zone: safetyZone,
      nearby_beach_m: nearbyBeach,
      price_band: priceBand,
    };
  }

  private shapeSafetyZone(raw: any): SafetyZoneDto | null {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.neighborhood) return null;

    const score = Number(raw.score ?? 0);
    const tone: SafetyTone =
      raw.tone === 'good' || raw.tone === 'ok' || raw.tone === 'caution'
        ? raw.tone
        : this.toneFromScore(score);

    return {
      neighborhood: String(raw.neighborhood),
      score,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      tone,
    };
  }

  private toneFromScore(score: number): SafetyTone {
    if (score >= 70) return 'good';
    if (score >= 50) return 'ok';
    return 'caution';
  }

  private shapePriceBand(raw: any): PriceBand | null {
    if (raw === 'asequible' || raw === 'medio' || raw === 'premium') {
      return raw;
    }
    return null;
  }
}
