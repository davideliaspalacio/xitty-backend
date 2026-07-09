import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { DiscoverService } from './discover.service';
import {
  CuratedItemCardDto,
  CuratedItemDetailDto,
} from './dto/curated-item.dto';

/**
 * PUBLIC DISCOVER API — feed publico de items curados que vienen del
 * pipeline de scraping (status='published'). Sin autenticacion.
 */
@ApiTags('discover')
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discoverService: DiscoverService) {}

  @Get('curated')
  @ApiOperation({
    summary:
      'Listado publico de items curados (status=published) ordenados por quality_score y recencia',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximo de items (default 20, max 100)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filtra por category_hint (ej. evento, tour, restaurante)',
  })
  @ApiResponse({ status: 200, type: [CuratedItemCardDto] })
  async findCurated(
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ): Promise<CuratedItemCardDto[]> {
    return this.discoverService.findCurated({
      limit: limit !== undefined ? Number(limit) : undefined,
      category: category?.trim() || undefined,
    });
  }

  @Get('curated/:id')
  @ApiOperation({
    summary:
      'Detalle de un item curado, incluye source_url, quality_score y scraped_at',
  })
  @ApiParam({ name: 'id', description: 'Enriched item id' })
  @ApiResponse({ status: 200, type: CuratedItemDetailDto })
  @ApiResponse({
    status: 404,
    description: 'Item no existe o no esta publicado',
  })
  async findCuratedById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CuratedItemDetailDto> {
    return this.discoverService.findCuratedById(id);
  }
}
