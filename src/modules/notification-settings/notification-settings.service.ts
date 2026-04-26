import {
  Injectable,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { NotificationSettingsDto } from './dto/notification-settings.dto';

const TABLE = 'business_notification_settings';

const DEFAULTS = {
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
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);

    if (!data) {
      return { user_id: userId, ...DEFAULTS };
    }
    return data as NotificationSettingsDto;
  }

  async upsert(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    const updates: Record<string, any> = { ...DEFAULTS, ...dto, user_id: userId };

    const { data, error } = await this.supabase
      .from(TABLE)
      .upsert(updates, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error || !data) {
      throw new BadRequestException(error?.message || 'Could not save settings');
    }
    return data as NotificationSettingsDto;
  }
}
