import { ApiProperty } from '@nestjs/swagger';

export class NotificationSettingsDto {
  @ApiProperty() user_id: string;
  @ApiProperty({ default: true }) notify_call_click: boolean;
  @ApiProperty({ default: true }) notify_whatsapp_click: boolean;
  @ApiProperty({ default: true }) notify_reservation_click: boolean;
  @ApiProperty({ default: true }) daily_summary: boolean;
  @ApiProperty({ required: false }) created_at?: string;
  @ApiProperty({ required: false }) updated_at?: string;
}
