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

import { FeaturedService } from './featured.service';
import { CreateFeaturedDto } from './dto/create-featured.dto';
import { UpdateFeaturedDto } from './dto/update-featured.dto';
import {
  FeaturedResponseDto,
  FeaturedListResponseDto,
} from './dto/featured-response.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('featured')
@Controller()
export class FeaturedController {
  constructor(private readonly featuredService: FeaturedService) {}

  @Get('featured/current')
  @ApiOperation({ summary: 'Currently active featured content (this week) — US-032' })
  @ApiResponse({ status: 200, type: [FeaturedResponseDto] })
  async findCurrent() {
    return this.featuredService.findCurrent();
  }

  @Get('featured')
  @ApiOperation({ summary: 'Paginated history of featured content — US-032' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: FeaturedListResponseDto })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.featuredService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Post('admin/featured')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a featured entry (admin) — US-032' })
  @ApiBody({ type: CreateFeaturedDto })
  @ApiResponse({ status: 201, type: FeaturedResponseDto })
  @ApiResponse({ status: 403, description: 'Admin only' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async create(@Request() req: any, @Body() dto: CreateFeaturedDto) {
    return this.featuredService.create(req.user.id, req.user.role, dto);
  }

  @Patch('admin/featured/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a featured entry (admin) — US-032' })
  @ApiParam({ name: 'id', description: 'Featured entry ID' })
  @ApiBody({ type: UpdateFeaturedDto })
  @ApiResponse({ status: 200, type: FeaturedResponseDto })
  @ApiResponse({ status: 403, description: 'Admin only' })
  @ApiResponse({ status: 404, description: 'Featured entry not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateFeaturedDto,
  ) {
    return this.featuredService.update(id, req.user.role, dto);
  }

  @Delete('admin/featured/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a featured entry (admin) — US-032' })
  @ApiParam({ name: 'id', description: 'Featured entry ID' })
  @ApiResponse({ status: 204, description: 'Featured entry deleted' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.featuredService.remove(id, req.user.role);
  }
}
