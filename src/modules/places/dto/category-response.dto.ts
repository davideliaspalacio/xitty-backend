import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ description: 'Category ID' })
  id: string;

  @ApiProperty({ description: 'Category name', example: 'Restaurantes' })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'restaurantes' })
  slug: string;

  @ApiProperty({ description: 'Icon identifier', example: 'utensils', nullable: true })
  icon: string | null;

  @ApiProperty({ description: 'Category description', nullable: true })
  description: string | null;
}
