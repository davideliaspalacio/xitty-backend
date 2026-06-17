import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { SuggestionsService } from './suggestions.service';
import { SuggestionQueryDto } from './dto/suggestion-query.dto';
import { SuggestionResponseDto } from './dto/suggestion-response.dto';

@ApiTags('suggestions')
@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Get('context')
  @ApiOperation({
    summary:
      'Sugerencias contextuales (zona segura, playa cercana, banda de precio)',
    description:
      'Endpoint público que devuelve metadata para que el frontend muestre ' +
      'badges contextuales tipo "Zona segura", "Playa a 800m", "Rango medio".',
  })
  @ApiResponse({ status: 200, type: SuggestionResponseDto })
  @ApiResponse({ status: 400, description: 'lat/lng inválidos' })
  async getContext(
    @Query() query: SuggestionQueryDto,
  ): Promise<SuggestionResponseDto> {
    return this.suggestionsService.getContext(query.lat, query.lng);
  }
}
