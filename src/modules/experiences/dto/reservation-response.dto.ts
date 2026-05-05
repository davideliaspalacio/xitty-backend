import { ApiProperty } from '@nestjs/swagger';

export class ReservationExperienceDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) slug: string | null;
  @ApiProperty() duration_minutes: number;
  @ApiProperty({ nullable: true }) cover_photo_url: string | null;
}

export class ReservationSlotDto {
  @ApiProperty() id: string;
  @ApiProperty() starts_at: string;
}

export class ReservationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() slot_id: string;
  @ApiProperty() experience_id: string;
  @ApiProperty() user_id: string;
  @ApiProperty() participants: number;
  @ApiProperty() total_price_cop: number;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true }) cancelled_at: string | null;
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
  @ApiProperty({ nullable: true, type: ReservationSlotDto }) slot: ReservationSlotDto | null;
  @ApiProperty({ nullable: true, type: ReservationExperienceDto }) experience: ReservationExperienceDto | null;
}

export class ReservationListResponseDto {
  @ApiProperty({ type: [ReservationResponseDto] }) data: ReservationResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
