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
  ApiQuery,
} from '@nestjs/swagger';

import { ExperiencesService } from './experiences.service';
import { ReservationsService } from './reservations.service';
import { ExperienceReviewsService } from './experience-reviews.service';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { ExperienceListQueryDto } from './dto/experience-list-query.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  CreateExperienceReviewDto,
  UpdateExperienceReviewDto,
} from './dto/create-experience-review.dto';
import { CreatePlacePhotoDto } from '../places/dto/create-place-photo.dto';
import {
  ExperienceDetailDto,
  ExperienceListResponseDto,
  SlotResponseDto,
} from './dto/experience-response.dto';
import {
  ReservationResponseDto,
  ReservationListResponseDto,
} from './dto/reservation-response.dto';
import {
  ExperienceReviewListResponseDto,
  ExperienceReviewResponseDto,
  RatingDistributionResponseDto,
} from './dto/experience-review-response.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

interface AuthenticatedRequest {
  user: {
    id: string;
    role: string;
  };
}

@ApiTags('experiences')
@Controller()
export class ExperiencesController {
  constructor(
    private readonly experiences: ExperiencesService,
    private readonly reservations: ReservationsService,
    private readonly reviews: ExperienceReviewsService,
  ) {}

  // ── Catalog ───────────────────────────────────────────────────────────

  @Get('experiences')
  @ApiOperation({
    summary: 'Paginated list of experiences with filters — US-040',
  })
  @ApiResponse({ status: 200, type: ExperienceListResponseDto })
  async findAll(@Query() query: ExperienceListQueryDto) {
    return this.experiences.findAll(query);
  }

  @Get('experiences/:id')
  @ApiOperation({ summary: 'Experience detail with photos — US-040' })
  @ApiResponse({ status: 200, type: ExperienceDetailDto })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.experiences.findById(id);
  }

  // ── Slots ─────────────────────────────────────────────────────────────

  @Get('experiences/:id/slots')
  @ApiOperation({ summary: 'List bookable slots for an experience — US-041' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200, type: [SlotResponseDto] })
  async findSlots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.experiences.findSlots(id, from, to);
  }

  @Post('experiences/:id/slots')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a slot (owner or admin) — US-041' })
  @ApiBody({ type: CreateSlotDto })
  @ApiResponse({ status: 201, type: SlotResponseDto })
  async createSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateSlotDto,
  ) {
    return this.experiences.createSlot(id, req.user.id, req.user.role, dto);
  }

  @Delete('experiences/:id/slots/:slotId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete (or soft-disable) a slot — US-041' })
  async deleteSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.experiences.deleteSlot(id, slotId, req.user.id, req.user.role);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────

  @Post('experiences')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create an experience (business or admin) — US-040',
  })
  @ApiBody({ type: CreateExperienceDto })
  @ApiResponse({ status: 201, type: ExperienceDetailDto })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateExperienceDto,
  ) {
    return this.experiences.create(req.user.id, req.user.role, dto);
  }

  @Patch('experiences/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an experience (owner or admin) — US-040' })
  @ApiBody({ type: UpdateExperienceDto })
  @ApiResponse({ status: 200, type: ExperienceDetailDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateExperienceDto,
  ) {
    return this.experiences.update(id, req.user.id, req.user.role, dto);
  }

  @Delete('experiences/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete an experience (admin) — US-040' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.experiences.softDelete(id, req.user.role);
  }

  @Post('experiences/:id/photos')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a photo (owner or admin) — US-040' })
  @ApiBody({ type: CreatePlacePhotoDto })
  async addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePlacePhotoDto,
  ) {
    return this.experiences.addPhoto(id, req.user.id, req.user.role, dto);
  }

  // ── Reservations ──────────────────────────────────────────────────────

  @Post('experiences/:id/reservations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reserve a slot — US-041' })
  @ApiBody({ type: CreateReservationDto })
  @ApiResponse({ status: 201, type: ReservationResponseDto })
  async createReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservations.create(id, req.user.id, dto);
  }

  @Get('me/reservations')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my reservations — US-041' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: ReservationListResponseDto })
  async findMyReservations(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reservations.findMine(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Delete('reservations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel a reservation (within cancellation window) — US-041',
  })
  async cancelReservation(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.reservations.cancel(id, req.user.id, req.user.role);
  }

  // ── Reviews ───────────────────────────────────────────────────────────

  @Get('experiences/:id/reviews')
  @ApiOperation({ summary: 'List reviews for an experience — US-043' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['recent', 'top'] })
  @ApiResponse({ status: 200, type: ExperienceReviewListResponseDto })
  async findReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: 'recent' | 'top',
  ) {
    return this.reviews.findByExperience(
      id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      sort ?? 'recent',
    );
  }

  @Get('experiences/:id/rating-distribution')
  @ApiOperation({
    summary: 'Star distribution histogram for an experience — US-043',
  })
  @ApiResponse({ status: 200, type: RatingDistributionResponseDto })
  async ratingDistribution(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.getRatingDistribution(id);
  }

  @Post('experiences/:id/reviews')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a review with optional photos — US-043' })
  @ApiBody({ type: CreateExperienceReviewDto })
  @ApiResponse({ status: 201, type: ExperienceReviewResponseDto })
  async createReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateExperienceReviewDto,
  ) {
    return this.reviews.create(id, req.user.id, dto);
  }

  @Patch('experiences/:id/reviews')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my review — US-043' })
  @ApiBody({ type: UpdateExperienceReviewDto })
  @ApiResponse({ status: 200, type: ExperienceReviewResponseDto })
  async updateReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateExperienceReviewDto,
  ) {
    return this.reviews.update(id, req.user.id, dto);
  }

  @Delete('experiences/:id/reviews')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my review — US-043' })
  async deleteReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.reviews.remove(id, req.user.id, req.user.role);
  }
}
