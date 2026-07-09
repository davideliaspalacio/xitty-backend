import {
  Controller,
  Get,
  Patch,
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
import { UpdateRankingConfigDto } from './dto/update-ranking-config.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

interface AuthenticatedRequest {
  user: {
    role: string;
  };
}

@ApiTags('ranking')
@Controller()
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get('ranking')
  @ApiOperation({
    summary:
      'Top global ranking across all categories, optionally by city — US-030',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'city', required: false, example: 'Cartagena' })
  @ApiResponse({ status: 200, type: RankingListResponseDto })
  async getGlobal(@Query() query: RankingQueryDto) {
    return this.rankingService.getGlobalRanking(
      query.limit ?? 10,
      query.city ?? null,
    );
  }

  @Get('ranking/categories/:categoryId')
  @ApiOperation({ summary: 'Top ranking inside one category — US-030' })
  @ApiParam({ name: 'categoryId', description: 'Category ID' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'city', required: false, example: 'Cartagena' })
  @ApiResponse({ status: 200, type: RankingListResponseDto })
  async getByCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query() query: RankingQueryDto,
  ) {
    return this.rankingService.getCategoryRanking(
      categoryId,
      query.limit ?? 20,
      query.city ?? null,
    );
  }

  @Post('admin/ranking/refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Force a refresh of the rankings (admin) — US-030' })
  @ApiResponse({ status: 200, description: 'Rankings refreshed' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  async refresh(@Request() req: AuthenticatedRequest) {
    this.assertAdmin(req);
    return this.rankingService.refresh();
  }

  @Get('admin/ranking/config')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read ranking formula config (admin) — F7' })
  @ApiResponse({ status: 200, description: 'Ranking config' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  async getConfig(@Request() req: AuthenticatedRequest) {
    this.assertAdmin(req);
    return this.rankingService.getConfig();
  }

  @Patch('admin/ranking/config')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update ranking formula config (admin) — F7' })
  @ApiBody({ type: UpdateRankingConfigDto })
  @ApiResponse({ status: 200, description: 'Ranking config updated' })
  @ApiResponse({ status: 400, description: 'Invalid ranking config' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  async updateConfig(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateRankingConfigDto,
  ) {
    this.assertAdmin(req);
    return this.rankingService.updateConfig(dto);
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
    @Request() req: AuthenticatedRequest,
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
    @Request() req: AuthenticatedRequest,
  ) {
    return this.rankingService.deactivateSponsorship(placeId, req.user.role);
  }

  private assertAdmin(req: AuthenticatedRequest): void {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
  }
}
