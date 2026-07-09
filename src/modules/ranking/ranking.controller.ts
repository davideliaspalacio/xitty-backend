import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { RankingService } from './ranking.service';
import { RankingQueryDto } from './dto/ranking-query.dto';
import { RankingListResponseDto } from './dto/ranking-response.dto';
import {
  CreateSponsorshipDto,
  SponsorshipResponseDto,
} from './dto/sponsorship.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('ranking')
@Controller()
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get('ranking')
  @ApiOperation({
    summary: 'Top global ranking across all categories — US-030',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, type: RankingListResponseDto })
  async getGlobal(@Query() query: RankingQueryDto) {
    return this.rankingService.getGlobalRanking(query.limit ?? 10);
  }

  @Get('ranking/categories/:categoryId')
  @ApiOperation({ summary: 'Top ranking inside one category — US-030' })
  @ApiParam({ name: 'categoryId', description: 'Category ID' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, type: RankingListResponseDto })
  async getByCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query() query: RankingQueryDto,
  ) {
    return this.rankingService.getCategoryRanking(
      categoryId,
      query.limit ?? 20,
    );
  }

  @Post('admin/ranking/refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Force a refresh of the rankings (admin) — US-030' })
  @ApiResponse({ status: 200, description: 'Rankings refreshed' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  async refresh(@Request() req: any) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
    return this.rankingService.refresh();
  }

  @Post('admin/places/:placeId/sponsorship')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activate paid placement for a place (admin) — US-031',
  })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiBody({ type: CreateSponsorshipDto })
  @ApiResponse({ status: 201, type: SponsorshipResponseDto })
  @ApiResponse({ status: 403, description: 'Admin only' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async activate(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: any,
    @Body() dto: CreateSponsorshipDto,
  ) {
    return this.rankingService.activateSponsorship(
      placeId,
      dto.duration_days,
      req.user.role,
      dto.priority ?? 0,
    );
  }

  @Delete('admin/places/:placeId/sponsorship')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate paid placement (admin) — US-031' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiResponse({ status: 200, type: SponsorshipResponseDto })
  @ApiResponse({ status: 403, description: 'Admin only' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async deactivate(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: any,
  ) {
    return this.rankingService.deactivateSponsorship(placeId, req.user.role);
  }
}
