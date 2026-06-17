import {
  Injectable,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import {
  LocationSource,
  SaveSnapshotsDto,
} from './dto/save-snapshots.dto';
import { LocationSnapshotDto } from './dto/location-snapshot.dto';

const TABLE = 'user_location_snapshots';
const MAX_BATCH = 10;

@Injectable()
export class LocationService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Guarda en lote snapshots de ubicacion del usuario.
   * Defensa-en-profundidad: aunque el DTO valida, revalidamos aqui
   * para servicios consumidos sin la pipeline HTTP (jobs, tests).
   */
  async saveSnapshots(
    userId: string,
    dto: SaveSnapshotsDto,
  ): Promise<{ inserted: number }> {
    const snapshots = dto?.snapshots ?? [];

    if (snapshots.length === 0) {
      throw new BadRequestException('At least one snapshot is required');
    }
    if (snapshots.length > MAX_BATCH) {
      throw new BadRequestException(
        `Cannot save more than ${MAX_BATCH} snapshots per batch`,
      );
    }

    const rows = snapshots.map((s) => {
      if (
        typeof s.lat !== 'number' ||
        Number.isNaN(s.lat) ||
        s.lat < -90 ||
        s.lat > 90
      ) {
        throw new BadRequestException(
          'lat must be a number between -90 and 90',
        );
      }
      if (
        typeof s.lng !== 'number' ||
        Number.isNaN(s.lng) ||
        s.lng < -180 ||
        s.lng > 180
      ) {
        throw new BadRequestException(
          'lng must be a number between -180 and 180',
        );
      }

      return {
        user_id: userId,
        latitude: s.lat,
        longitude: s.lng,
        accuracy_m: s.accuracy ?? null,
        source: s.source ?? LocationSource.BROWSER_GPS,
      };
    });

    const { data, error } = await this.supabase
      .from(TABLE)
      .insert(rows)
      .select('id');

    if (error) {
      throw new BadRequestException(
        error.message || 'Could not save snapshots',
      );
    }

    return { inserted: Array.isArray(data) ? data.length : rows.length };
  }

  /**
   * Borra todos los snapshots del usuario (US: borrar mis datos de ubicacion).
   */
  async deleteMine(userId: string): Promise<{ deleted: true }> {
    const { error } = await this.supabase
      .from(TABLE)
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestException(
        error.message || 'Could not delete snapshots',
      );
    }

    return { deleted: true };
  }

  /**
   * Devuelve el ultimo snapshot del usuario (o null si no tiene).
   * Util para hidratar la UI sin pedir GPS de nuevo.
   */
  async getLatest(userId: string): Promise<LocationSnapshotDto | null> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('id, user_id, latitude, longitude, accuracy_m, source, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data as LocationSnapshotDto) ?? null;
  }
}
