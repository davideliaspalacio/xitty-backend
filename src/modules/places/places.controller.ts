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
  ApiQuery,
} from '@nestjs/swagger';

import { PlacesService } from './places.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { PlaceListQueryDto } from './dto/place-list-query.dto';
import { CreatePlacePhotoDto } from './dto/create-place-photo.dto';
import { PlaceDetailDto, PlaceListResponseDto } from './dto/place-response.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { OgResponseDto } from './dto/og-response.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

interface AuthenticatedPlaceRequest {
  user: {
    id: string;
    role: string;
  };
}

@ApiTags('places')
@Controller()
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  // ── Categories ────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  async getCategories(): Promise<CategoryResponseDto[]> {
    return this.placesService.findAllCategories();
  }

  // ── Places (public) ───────────────────────────────────────────────

  @Get('places')
  @ApiOperation({ summary: 'Paginated list of places with filters — US-011' })
  @ApiResponse({ status: 200, type: PlaceListResponseDto })
  async findAll(@Query() query: PlaceListQueryDto) {
    return this.placesService.findAll(query);
  }

  @Get('places/search')
  @ApiOperation({ summary: 'Full-text search for places — US-013' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'category_id', required: false })
  @ApiQuery({ name: 'city', required: false, example: 'Cartagena' })
  @ApiQuery({ name: 'zone', required: false, example: 'Centro Historico' })
  @ApiResponse({ status: 200, type: PlaceListResponseDto })
  async search(
    @Query('q') q: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category_id') categoryId?: string,
    @Query('city') city?: string,
    @Query('zone') zone?: string,
  ) {
    return this.placesService.search(
      q,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      categoryId,
      city,
      zone,
    );
  }

  @Get('places/:id')
  @ApiOperation({ summary: 'Get place detail with photos — US-012' })
  @ApiParam({ name: 'id', description: 'Place ID' })
  @ApiResponse({ status: 200, type: PlaceDetailDto })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.placesService.findById(id);
  }

  @Get('places/:id/og')
  @ApiOperation({ summary: 'Open Graph metadata for sharing — US-016' })
  @ApiParam({ name: 'id', description: 'Place ID' })
  @ApiResponse({ status: 200, type: OgResponseDto })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async getOg(@Param('id', ParseUUIDPipe) id: string) {
    return this.placesService.getOgMetadata(id);
  }

  // ── Places (protected) ───────────────────────────────────────────

  @Post('places')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a place (business owner or admin)' })
  @ApiBody({ type: CreatePlaceDto })
  @ApiResponse({ status: 201, type: PlaceDetailDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — requires business or admin role',
  })
  async create(
    @Request() req: AuthenticatedPlaceRequest,
    @Body() dto: CreatePlaceDto,
  ) {
    return this.placesService.create(req.user.id, req.user.role, dto);
  }

  @Patch('places/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a place (owner or admin)' })
  @ApiParam({ name: 'id', description: 'Place ID' })
  @ApiBody({ type: UpdatePlaceDto })
  @ApiResponse({ status: 200, type: PlaceDetailDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedPlaceRequest,
    @Body() dto: UpdatePlaceDto,
  ) {
    return this.placesService.update(id, req.user.id, req.user.role, dto);
  }

  @Delete('places/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a place (admin only)' })
  @ApiParam({ name: 'id', description: 'Place ID' })
  @ApiResponse({ status: 204, description: 'Place deactivated' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedPlaceRequest,
  ) {
    return this.placesService.softDelete(id, req.user.role);
  }

  // ── Photos (protected) ───────────────────────────────────────────

  @Post('places/:id/photos')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a photo to a place (owner or admin)' })
  @ApiParam({ name: 'id', description: 'Place ID' })
  @ApiBody({ type: CreatePlacePhotoDto })
  @ApiResponse({ status: 201, description: 'Photo added' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedPlaceRequest,
    @Body() dto: CreatePlacePhotoDto,
  ) {
    return this.placesService.addPhoto(id, req.user.id, req.user.role, dto);
  }
}
