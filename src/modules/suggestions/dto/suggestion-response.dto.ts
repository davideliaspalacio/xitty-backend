import { ApiProperty } from '@nestjs/swagger';

export type SafetyTone = 'good' | 'ok' | 'caution';

export type PriceBand = 'asequible' | 'medio' | 'premium';

export class SafetyZoneDto {
  @ApiProperty({ example: 'El Prado' })
  neighborhood: string;

  @ApiProperty({
    description: 'Score de seguridad del barrio (0 peligroso, 100 muy seguro)',
    example: 78,
  })
  score: number;

  @ApiProperty({
    type: [String],
    description: 'Etiquetas descriptivas del barrio',
    example: ['turistica', 'iluminada'],
  })
  tags: string[];

  @ApiProperty({
    description:
      'Indicador legible: good (score≥70), ok (50≤score<70), caution (<50)',
    enum: ['good', 'ok', 'caution'],
    example: 'good',
  })
  tone: SafetyTone;
}

export class SuggestionResponseDto {
  @ApiProperty({
    type: SafetyZoneDto,
    required: false,
    nullable: true,
    description: 'Zona de seguridad más cercana, o null si no se encuentra',
  })
  safety_zone: SafetyZoneDto | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Distancia en metros a la playa más cercana, o null si está lejos',
    example: 850,
  })
  nearby_beach_m: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: ['asequible', 'medio', 'premium'],
    description: 'Banda de precio típica del área',
    example: 'medio',
  })
  price_band: PriceBand | null;
}
