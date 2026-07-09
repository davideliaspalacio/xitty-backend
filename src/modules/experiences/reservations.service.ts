import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  ReservationExperienceDto,
  ReservationListResponseDto,
  ReservationResponseDto,
  ReservationSlotDto,
} from './dto/reservation-response.dto';

const RESERVATIONS_TABLE = 'experience_reservations';
const SLOTS_TABLE = 'experience_slots';
const EXPERIENCES_TABLE = 'experiences';
const PHOTOS_TABLE = 'experience_photos';
const NOTIFICATION_SETTINGS_TABLE = 'business_notification_settings';
const NOTIFICATION_OUTBOX_TABLE = 'business_notification_outbox';

const RESERVATION_SELECT = `
  id, slot_id, experience_id, user_id, participants,
  total_price_cop, status, cancelled_at, created_at, updated_at,
  slot:slot_id(id, starts_at),
  experience:experience_id(id, title, slug, duration_minutes)
`;

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
  count?: number | null;
}

interface ExperienceRulesRow {
  id: string;
  operator_place_id: string;
  price_cop: number;
  min_participants: number;
  max_participants: number;
  is_active: boolean;
  places: { owner_id: string | null } | null;
}

interface SlotAvailabilityRow {
  id: string;
  experience_id: string;
  starts_at: string;
  capacity: number;
  seats_taken: number;
  is_active: boolean;
}

type ReservationExperienceRow = Omit<
  ReservationExperienceDto,
  'cover_photo_url'
>;

interface ReservationRow extends Omit<
  ReservationResponseDto,
  'slot' | 'experience'
> {
  slot: ReservationSlotDto | null;
  experience: ReservationExperienceRow | null;
}

interface ReservationCancelRow {
  id: string;
  user_id: string;
  status: string;
  slot_id: string;
  slot: Pick<ReservationSlotDto, 'starts_at'> | null;
  experience: { cancellation_hours: number | null } | null;
}

interface CoverPhotoRow {
  experience_id?: string;
  url: string;
}

interface NotificationSettingsRow {
  notify_reservation_click?: boolean;
}

@Injectable()
export class ReservationsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async create(
    experienceId: string,
    userId: string,
    dto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    // Load experience for pricing + participant rules
    const { data: experience, error: expError } = (await this.supabase
      .from(EXPERIENCES_TABLE)
      .select(
        'id, operator_place_id, price_cop, min_participants, max_participants, is_active, places:operator_place_id(owner_id)',
      )
      .eq('id', experienceId)
      .maybeSingle()) as unknown as SupabaseSingleResult<ExperienceRulesRow>;

    if (expError) throw new BadRequestException(expError.message);
    if (!experience) throw new NotFoundException('Experience not found');
    if (!experience.is_active) {
      throw new BadRequestException('Experience is not active');
    }

    if (dto.participants < experience.min_participants) {
      throw new BadRequestException(
        `Minimum ${experience.min_participants} participant(s) required`,
      );
    }
    if (dto.participants > experience.max_participants) {
      throw new BadRequestException(
        `Maximum ${experience.max_participants} participant(s) allowed`,
      );
    }

    // Validate the slot belongs to this experience and is bookable
    const { data: slot } = (await this.supabase
      .from(SLOTS_TABLE)
      .select('id, experience_id, starts_at, capacity, seats_taken, is_active')
      .eq('id', dto.slot_id)
      .maybeSingle()) as unknown as SupabaseSingleResult<SlotAvailabilityRow>;

    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.experience_id !== experienceId) {
      throw new BadRequestException('Slot does not belong to this experience');
    }
    if (!slot.is_active) throw new BadRequestException('Slot is not active');
    if (new Date(slot.starts_at).getTime() <= Date.now()) {
      throw new BadRequestException('Slot is in the past');
    }
    if (slot.seats_taken + dto.participants > slot.capacity) {
      throw new BadRequestException('Not enough seats available in this slot');
    }

    const totalPriceCop = experience.price_cop * dto.participants;

    const { data, error } = (await this.supabase
      .from(RESERVATIONS_TABLE)
      .insert({
        slot_id: dto.slot_id,
        experience_id: experienceId,
        user_id: userId,
        participants: dto.participants,
        total_price_cop: totalPriceCop,
        status: 'confirmed',
      })
      .select(RESERVATION_SELECT)
      .single()) as unknown as SupabaseSingleResult<ReservationRow>;

    if (error) {
      // The trigger raises 'Slot is full' if a concurrent booking ate the cupo.
      if (error.message?.toLowerCase().includes('slot is full')) {
        throw new BadRequestException(
          'Slot just filled up, please pick another one',
        );
      }
      throw new BadRequestException(error.message);
    }

    if (!data) {
      throw new BadRequestException('Could not create reservation');
    }

    await this.queueReservationNotification(data, experience);

    return this.hydrateCover(data);
  }

  async findMine(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<ReservationListResponseDto> {
    const offset = (page - 1) * limit;

    const { data, error, count } = (await this.supabase
      .from(RESERVATIONS_TABLE)
      .select(RESERVATION_SELECT, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(
        offset,
        offset + limit - 1,
      )) as unknown as SupabaseListResult<ReservationRow>;

    if (error) throw new BadRequestException(error.message);

    const items = data || [];
    const hydrated = await this.hydrateCovers(items);

    return {
      data: hydrated,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async cancel(
    reservationId: string,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const { data: reservation } = (await this.supabase
      .from(RESERVATIONS_TABLE)
      .select(
        `
        id, user_id, status, slot_id,
        slot:slot_id(starts_at),
        experience:experience_id(cancellation_hours)
      `,
      )
      .eq('id', reservationId)
      .maybeSingle()) as unknown as SupabaseSingleResult<ReservationCancelRow>;

    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.user_id !== userId && userRole !== 'admin') {
      throw new ForbiddenException('You can only cancel your own reservations');
    }
    if (reservation.status !== 'confirmed') {
      throw new BadRequestException(
        `Reservation already ${reservation.status}`,
      );
    }

    const startsAt = new Date(reservation.slot?.starts_at ?? '');
    const cancellationHours = reservation.experience?.cancellation_hours ?? 24;
    const hoursUntilStart = (startsAt.getTime() - Date.now()) / 3600_000;

    if (hoursUntilStart < cancellationHours) {
      throw new BadRequestException(
        `Cancellations are only allowed up to ${cancellationHours}h before the experience starts`,
      );
    }

    const { error } = await this.supabase
      .from(RESERVATIONS_TABLE)
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', reservationId);

    if (error) throw new BadRequestException(error.message);
  }

  // ── helpers ───────────────────────────────────────────────────────────

  private async hydrateCover(
    reservation: ReservationRow,
  ): Promise<ReservationResponseDto> {
    if (!reservation.experience?.id) {
      return { ...reservation, experience: null };
    }

    const { data: cover } = (await this.supabase
      .from(PHOTOS_TABLE)
      .select('url')
      .eq('experience_id', reservation.experience.id)
      .eq('is_cover', true)
      .maybeSingle()) as unknown as SupabaseSingleResult<CoverPhotoRow>;

    return {
      ...reservation,
      experience: {
        ...reservation.experience,
        cover_photo_url: cover?.url ?? null,
      },
    };
  }

  private async hydrateCovers(
    reservations: ReservationRow[],
  ): Promise<ReservationResponseDto[]> {
    const ids = Array.from(
      new Set(
        reservations
          .map((reservation) => reservation.experience?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (ids.length === 0) {
      return reservations.map((reservation) => ({
        ...reservation,
        experience: reservation.experience
          ? { ...reservation.experience, cover_photo_url: null }
          : null,
      }));
    }

    const { data: covers } = (await this.supabase
      .from(PHOTOS_TABLE)
      .select('experience_id, url')
      .in('experience_id', ids)
      .eq('is_cover', true)) as unknown as SupabaseListResult<CoverPhotoRow>;

    const map = new Map(
      (covers || []).map((cover) => [cover.experience_id, cover.url]),
    );

    return reservations.map((reservation) => ({
      ...reservation,
      experience: reservation.experience
        ? {
            ...reservation.experience,
            cover_photo_url: map.get(reservation.experience.id) ?? null,
          }
        : null,
    }));
  }

  private async queueReservationNotification(
    reservation: ReservationRow,
    experience: ExperienceRulesRow,
  ): Promise<void> {
    const ownerId = experience.places?.owner_id ?? null;
    if (!ownerId) return;

    try {
      const settingsResult = await this.supabase
        .from(NOTIFICATION_SETTINGS_TABLE)
        .select('notify_reservation_click')
        .eq('user_id', ownerId)
        .maybeSingle();
      const settings = settingsResult.data as NotificationSettingsRow | null;

      if (
        settingsResult.error ||
        settings?.notify_reservation_click === false
      ) {
        return;
      }

      await this.supabase.from(NOTIFICATION_OUTBOX_TABLE).insert({
        recipient_user_id: ownerId,
        place_id: experience.operator_place_id,
        interaction_id: null,
        notification_type: 'reservation_created',
        channel: 'pending',
        status: 'pending',
        dedup_key: `reservation_created:${reservation.id}`,
        payload: {
          reservation_id: reservation.id,
          experience_id: reservation.experience_id,
          experience_title: reservation.experience?.title ?? null,
          slot_id: reservation.slot_id,
          starts_at: reservation.slot?.starts_at ?? null,
          participants: reservation.participants,
          total_price_cop: reservation.total_price_cop,
        },
      });
    } catch {
      return;
    }
  }
}
