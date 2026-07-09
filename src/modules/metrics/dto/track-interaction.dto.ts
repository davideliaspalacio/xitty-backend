import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum InteractionType {
  PROFILE_VIEW = 'profile_view',
  CALL_CLICK = 'call_click',
  WHATSAPP_CLICK = 'whatsapp_click',
  RESERVATION_CLICK = 'reservation_click',
  DIRECTIONS_CLICK = 'directions_click',
  PROMO_VIEW = 'promo_view',
}

export class TrackInteractionDto {
  @ApiProperty({ description: 'Type of interaction', enum: InteractionType })
  @IsEnum(InteractionType)
  interaction_type: InteractionType;

  @ApiProperty({
    description: 'Promotion ID (only for promo_view)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  promo_id?: string;

  @ApiProperty({
    description: 'Stable anonymous browser session id. Stored only as a hash.',
    required: false,
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  anonymous_session_id?: string;
}
