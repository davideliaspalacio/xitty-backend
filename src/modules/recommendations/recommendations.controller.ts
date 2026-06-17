import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { RecommendationsService } from './recommendations.service';
import { TodayQueryDto } from './dto/today-query.dto';
import { TodayRecommendationsResponseDto } from './dto/recommendation-item.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('recommendations')
@UseGuards(AuthGuard)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('today')
  @ApiOperation({
    summary:
      '"Vale la pena hoy" — top N lugares recomendados con razón en español',
    description:
      'Combina preferencias del usuario, ubicación, hora actual y ranking ' +
      'base para sugerir lugares relevantes ahora mismo.',
  })
  @ApiResponse({
    status: 200,
    type: TodayRecommendationsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async today(
    @Request() req: any,
    @Query() query: TodayQueryDto,
  ): Promise<TodayRecommendationsResponseDto> {
    return this.recommendationsService.today(req.user.id, query);
  }
}
