import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

import { MicrositesService } from './microsites.service';
import { MicrositeResponseDto } from './dto/microsite-response.dto';

@ApiTags('microsites')
@Controller('microsites')
export class MicrositesController {
  constructor(private readonly micrositesService: MicrositesService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Get microsite by slug — US-021' })
  @ApiParam({ name: 'slug', description: 'URL slug (e.g. la-trattoria)' })
  @ApiResponse({ status: 200, type: MicrositeResponseDto })
  @ApiResponse({ status: 404, description: 'Microsite not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.micrositesService.findBySlug(slug);
  }
}
