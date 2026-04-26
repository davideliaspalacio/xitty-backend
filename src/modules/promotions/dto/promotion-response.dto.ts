import { ApiProperty } from '@nestjs/swagger';

export class PromotionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() place_id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) discount_percentage: number | null;
  @ApiProperty() starts_at: string;
  @ApiProperty() ends_at: string;
  @ApiProperty() is_active: boolean;
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
}

export class ActivePromotionListDto {
  @ApiProperty() id: string;
  @ApiProperty() place_id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) discount_percentage: number | null;
  @ApiProperty() starts_at: string;
  @ApiProperty() ends_at: string;
  @ApiProperty({ nullable: true })
  places: { id: string; name: string; slug: string | null } | null;
}

export class PromotionListResponseDto {
  @ApiProperty({ type: [ActivePromotionListDto] }) data: ActivePromotionListDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
