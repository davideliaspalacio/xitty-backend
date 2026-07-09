import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
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

import { MetricsService } from './metrics.service';
import { TrackInteractionDto } from './dto/track-interaction.dto';
import {
  MetricsRangeQueryDto,
  MetricsSummaryDto,
} from './dto/metrics-summary.dto';
import {
  MetricsTimeseriesQueryDto,
  MetricsTimeseriesBucketDto,
  TimeseriesGranularity,
} from './dto/metrics-timeseries.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import * as jwt from 'jsonwebtoken';

type HeaderValue = string | string[] | undefined;

interface MetricsRequestHeaders {
  authorization?: HeaderValue;
  'user-agent'?: HeaderValue;
}

interface OptionalAuthRequest {
  headers: MetricsRequestHeaders;
}

interface AuthenticatedMetricsRequest extends OptionalAuthRequest {
  user: {
    id: string;
    role: string;
  };
}

@ApiTags('metrics')
@Controller('places/:placeId')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post('interactions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Track a microsite interaction (auth optional) — US-023',
  })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiBody({ type: TrackInteractionDto })
  @ApiResponse({ status: 204, description: 'Interaction recorded' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async track(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: OptionalAuthRequest,
    @Body() dto: TrackInteractionDto,
  ) {
    // Optional auth: extract user_id from Bearer token if present
    const userId = this.tryExtractUserId(req);
    return this.metricsService.track(placeId, userId, dto, {
      userAgent: firstHeader(req.headers['user-agent']),
    });
  }

  @Get('metrics/summary')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get metrics summary with previous-period comparison — US-023',
  })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiResponse({ status: 200, type: MetricsSummaryDto })
  @ApiResponse({ status: 403, description: 'Not the owner of this place' })
  async getSummary(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: AuthenticatedMetricsRequest,
    @Query() query: MetricsRangeQueryDto,
  ) {
    return this.metricsService.getSummary(
      placeId,
      req.user.id,
      req.user.role,
      query.from,
      query.to,
    );
  }

  @Get('metrics/timeseries')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get metrics time series by day or week — US-023' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: TimeseriesGranularity,
  })
  @ApiResponse({ status: 200, type: [MetricsTimeseriesBucketDto] })
  @ApiResponse({ status: 403, description: 'Not the owner of this place' })
  async getTimeseries(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: AuthenticatedMetricsRequest,
    @Query() query: MetricsTimeseriesQueryDto,
  ) {
    return this.metricsService.getTimeseries(
      placeId,
      req.user.id,
      req.user.role,
      query.from,
      query.to,
      query.granularity || TimeseriesGranularity.DAY,
    );
  }

  private tryExtractUserId(req: OptionalAuthRequest): string | null {
    const authHeader = firstHeader(req.headers.authorization);
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    try {
      const decoded = jwt.verify(token, secret) as unknown;
      if (!isRecord(decoded)) return null;
      return decoded.type === 'access' && typeof decoded.sub === 'string'
        ? decoded.sub
        : null;
    } catch {
      return null;
    }
  }
}

function firstHeader(value: HeaderValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
