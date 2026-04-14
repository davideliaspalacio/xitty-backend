import { ApiProperty } from '@nestjs/swagger';

export class OgResponseDto {
  @ApiProperty({ example: 'La Trattoria' })
  title: string;

  @ApiProperty({ example: 'Restaurante italiano en el centro de Barranquilla' })
  description: string;

  @ApiProperty({ example: 'https://storage.example.com/photo.jpg', nullable: true })
  image: string | null;

  @ApiProperty({ example: 'https://xitty.co/places/abc-123' })
  url: string;

  @ApiProperty({ example: 4.5 })
  rating: number;

  @ApiProperty({ example: 'Xitty' })
  site_name: string;
}
