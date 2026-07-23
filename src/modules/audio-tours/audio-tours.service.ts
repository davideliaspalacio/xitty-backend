import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import { AudioTourQueryDto } from './dto/audio-tour-query.dto';
import { UpdateAudioTourProgressDto } from './dto/update-audio-tour-progress.dto';
import {
  AudioTourDto,
  AudioTourListResponseDto,
  AudioTourProgressDto,
  AudioTourStopDto,
} from './dto/audio-tour-response.dto';

const TOURS_TABLE = 'audio_tours';
const STOPS_TABLE = 'audio_tour_stops';
const PROGRESS_TABLE = 'audio_tour_progress';

const TOUR_SELECT =
  'id, place_id, title, description, language_code, narrator_name, estimated_duration_min, cover_image_url, is_active, created_at, updated_at';

const STOP_SELECT =
  'id, audio_tour_id, title, description, audio_url, transcript, language_code, duration_seconds, display_order, latitude, longitude, radius_m';

const PROGRESS_SELECT =
  'user_id, audio_tour_id, current_stop_id, completed_stop_ids, last_position_seconds, completed_at, updated_at';

interface AudioTourRow {
  id: string;
  place_id: string;
  title: string;
  description: string | null;
  language_code: string;
  narrator_name: string | null;
  estimated_duration_min: number | string | null;
  cover_image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AudioToursService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findByPlace(
    placeId: string,
    query: AudioTourQueryDto = {},
  ): Promise<AudioTourListResponseDto> {
    let builder = this.supabase
      .from(TOURS_TABLE)
      .select(TOUR_SELECT)
      .eq('place_id', placeId)
      .eq('is_active', true)
      .order('language_code', { ascending: true });

    if (query.lang) {
      builder = builder.eq('language_code', query.lang);
    }

    const { data, error } = await builder;

    if (error) throwDbError(error, 'AudioToursService');

    const tours = (data || []) as AudioTourRow[];
    const stopsByTour = await this.getStopsByTourIds(
      tours.map((tour) => tour.id),
    );

    return {
      data: tours.map((tour) =>
        this.toTourDto(tour, stopsByTour.get(tour.id) || []),
      ),
    };
  }

  async findById(id: string): Promise<AudioTourDto> {
    const { data, error } = await this.supabase
      .from(TOURS_TABLE)
      .select(TOUR_SELECT)
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throwDbError(error, 'AudioToursService');
    if (!data) throw new NotFoundException('Audio tour not found');

    const tour = data as AudioTourRow;
    const stopsByTour = await this.getStopsByTourIds([id]);
    return this.toTourDto(tour, stopsByTour.get(id) || []);
  }

  async getProgress(
    userId: string,
    tourId: string,
  ): Promise<AudioTourProgressDto | null> {
    const { data, error } = await this.supabase
      .from(PROGRESS_TABLE)
      .select(PROGRESS_SELECT)
      .eq('user_id', userId)
      .eq('audio_tour_id', tourId)
      .maybeSingle();

    if (error) throwDbError(error, 'AudioToursService');
    return (data as AudioTourProgressDto) ?? null;
  }

  async updateProgress(
    userId: string,
    tourId: string,
    dto: UpdateAudioTourProgressDto,
  ): Promise<AudioTourProgressDto> {
    await this.findById(tourId);

    const existing = await this.getProgress(userId, tourId);
    const completedStopIds = this.uniqueIds(
      dto.completed_stop_ids ?? existing?.completed_stop_ids ?? [],
    );
    const currentStopId =
      dto.current_stop_id === undefined
        ? (existing?.current_stop_id ?? null)
        : dto.current_stop_id;

    await this.assertStopsBelongToTour(tourId, [
      ...completedStopIds,
      ...(currentStopId ? [currentStopId] : []),
    ]);

    const completedAt =
      dto.completed === true
        ? new Date().toISOString()
        : dto.completed === false
          ? null
          : (existing?.completed_at ?? null);

    const row = {
      user_id: userId,
      audio_tour_id: tourId,
      current_stop_id: currentStopId,
      completed_stop_ids: completedStopIds,
      last_position_seconds:
        dto.last_position_seconds ?? existing?.last_position_seconds ?? 0,
      completed_at: completedAt,
    };

    const { data, error } = await this.supabase
      .from(PROGRESS_TABLE)
      .upsert(row, { onConflict: 'user_id,audio_tour_id' })
      .select(PROGRESS_SELECT)
      .single();

    if (error) throwDbError(error, 'AudioToursService');
    return data as AudioTourProgressDto;
  }

  private async getStopsByTourIds(
    tourIds: string[],
  ): Promise<Map<string, AudioTourStopDto[]>> {
    const map = new Map<string, AudioTourStopDto[]>();
    if (tourIds.length === 0) return map;

    const { data, error } = await this.supabase
      .from(STOPS_TABLE)
      .select(STOP_SELECT)
      .in('audio_tour_id', tourIds)
      .order('display_order', { ascending: true });

    if (error) throwDbError(error, 'AudioToursService');

    for (const stop of (data || []) as AudioTourStopDto[]) {
      const stops = map.get(stop.audio_tour_id) || [];
      stops.push(stop);
      map.set(stop.audio_tour_id, stops);
    }

    return map;
  }

  private async assertStopsBelongToTour(
    tourId: string,
    stopIds: string[],
  ): Promise<void> {
    const unique = this.uniqueIds(stopIds);
    if (unique.length === 0) return;

    const { data, error } = await this.supabase
      .from(STOPS_TABLE)
      .select('id')
      .eq('audio_tour_id', tourId)
      .in('id', unique);

    if (error) throwDbError(error, 'AudioToursService');

    const found = new Set(
      ((data || []) as Array<{ id: string }>).map((s) => s.id),
    );
    const missing = unique.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        'All stop ids must belong to the requested audio tour',
      );
    }
  }

  private uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids.filter(Boolean)));
  }

  private toTourDto(
    tour: AudioTourRow,
    stops: AudioTourStopDto[],
  ): AudioTourDto {
    return {
      id: tour.id,
      place_id: tour.place_id,
      title: tour.title,
      description: tour.description ?? null,
      language_code: tour.language_code,
      narrator_name: tour.narrator_name ?? null,
      estimated_duration_min: Number(tour.estimated_duration_min ?? 0),
      cover_image_url: tour.cover_image_url ?? null,
      is_active: Boolean(tour.is_active),
      stops,
      created_at: tour.created_at,
      updated_at: tour.updated_at,
    };
  }
}
