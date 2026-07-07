import { ApiProperty } from '@nestjs/swagger';

export class AudioTourStopDto {
  @ApiProperty() id: string;
  @ApiProperty() audio_tour_id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) audio_url: string | null;
  @ApiProperty({ nullable: true }) transcript: string | null;
  @ApiProperty() language_code: string;
  @ApiProperty() duration_seconds: number;
  @ApiProperty() display_order: number;
  @ApiProperty({ nullable: true }) latitude: number | null;
  @ApiProperty({ nullable: true }) longitude: number | null;
  @ApiProperty({ nullable: true }) radius_m: number | null;
}

export class AudioTourDto {
  @ApiProperty() id: string;
  @ApiProperty() place_id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() language_code: string;
  @ApiProperty({ nullable: true }) narrator_name: string | null;
  @ApiProperty() estimated_duration_min: number;
  @ApiProperty({ nullable: true }) cover_image_url: string | null;
  @ApiProperty() is_active: boolean;
  @ApiProperty({ type: [AudioTourStopDto] }) stops: AudioTourStopDto[];
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
}

export class AudioTourListResponseDto {
  @ApiProperty({ type: [AudioTourDto] })
  data: AudioTourDto[];
}

export class AudioTourProgressDto {
  @ApiProperty() user_id: string;
  @ApiProperty() audio_tour_id: string;
  @ApiProperty({ nullable: true }) current_stop_id: string | null;
  @ApiProperty({ type: [String] }) completed_stop_ids: string[];
  @ApiProperty() last_position_seconds: number;
  @ApiProperty({ nullable: true }) completed_at: string | null;
  @ApiProperty() updated_at: string;
}
