import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
} from '@nestjs/swagger';

import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import {
  ReviewResponseDto,
  ReviewListResponseDto,
} from './dto/review-response.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

interface AuthenticatedReviewRequest {
  user: {
    id: string;
  };
}

@ApiTags('reviews')
@Controller('places/:placeId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews for a place — US-014' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiResponse({ status: 200, type: ReviewListResponseDto })
  async findAll(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewsService.findByPlaceId(
      placeId,
      pagination.page,
      pagination.limit,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a review (one per user per place) — US-014',
  })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({ status: 201, type: ReviewResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  @ApiResponse({
    status: 409,
    description: 'Already reviewed — use PATCH to update',
  })
  async create(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: AuthenticatedReviewRequest,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(placeId, req.user.id, dto);
  }

  @Patch()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update your review — US-014' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiBody({ type: UpdateReviewDto })
  @ApiResponse({ status: 200, type: ReviewResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async update(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: AuthenticatedReviewRequest,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(placeId, req.user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete your review — US-014' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiResponse({ status: 204, description: 'Review deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: AuthenticatedReviewRequest,
  ) {
    return this.reviewsService.remove(placeId, req.user.id);
  }
}
