import { ApiProperty } from '@nestjs/swagger';
import { PlaceDetailDto } from '../../places/dto/place-response.dto';

export class ActivePromotionDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) discount_percentage: number | null;
  @ApiProperty() starts_at: string;
  @ApiProperty() ends_at: string;
}

export class MicrositeResponseDto extends PlaceDetailDto {
  @ApiProperty({ type: [ActivePromotionDto] })
  active_promotions: ActivePromotionDto[];
}
