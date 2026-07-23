import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { throwDbError } from '../../common/errors/throw-db-error';

import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { NotificationSettingsDto } from './dto/notification-settings.dto';

const TABLE = 'business_notification_settings';

type NotificationSettingsFields = Pick<
  NotificationSettingsDto,
  | 'notify_call_click'
  | 'notify_whatsapp_click'
  | 'notify_reservation_click'
  | 'daily_summary'
>;

type NotificationSettingsUpsert = NotificationSettingsFields & {
  user_id: string;
};

interface SupabaseError {
  message: string;
}

interface SupabaseSingleResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

const DEFAULTS: NotificationSettingsFields = {
  notify_call_click: true,
  notify_whatsapp_click: true,
  notify_reservation_click: true,
  daily_summary: true,
};

@Injectable()
export class NotificationSettingsService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async getOrDefaults(userId: string): Promise<NotificationSettingsDto> {
    const { data, error } = (await this.supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()) as unknown as SupabaseSingleResult<NotificationSettingsDto>;

    if (error) throwDbError(error, 'NotificationSettingsService');

    if (!data) {
      return { user_id: userId, ...DEFAULTS };
    }
    return data;
  }

  async upsert(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    const updates: NotificationSettingsUpsert = {
      ...DEFAULTS,
      ...dto,
      user_id: userId,
    };

    const { data, error } = (await this.supabase
      .from(TABLE)
      .upsert(updates, { onConflict: 'user_id' })
      .select('*')
      .single()) as unknown as SupabaseSingleResult<NotificationSettingsDto>;

    if (error || !data) {
      throw new BadRequestException(
        error?.message || 'Could not save settings',
      );
    }
    return data;
  }
}
