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

import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import {
  PromotionResponseDto,
  PromotionListResponseDto,
} from './dto/promotion-response.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('promotions')
@Controller()
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('promotions/active')
  @ApiOperation({ summary: 'List all currently active promotions across the directory' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: PromotionListResponseDto })
  async findAllActive(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.promotionsService.findAllActive(
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Get('places/:placeId/promotions')
  @ApiOperation({ summary: 'List active promotions for a place — US-024' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiResponse({ status: 200, type: [PromotionResponseDto] })
  async findActiveByPlace(@Param('placeId', ParseUUIDPipe) placeId: string) {
    return this.promotionsService.findActiveByPlace(placeId);
  }

  @Post('places/:placeId/promotions')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a promotion (owner or admin) — US-024' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiBody({ type: CreatePromotionDto })
  @ApiResponse({ status: 201, type: PromotionResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the owner of this place' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async create(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: any,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.promotionsService.create(placeId, req.user.id, req.user.role, dto);
  }

  @Patch('places/:placeId/promotions/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a promotion (owner or admin) — US-024' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiParam({ name: 'id', description: 'Promotion ID' })
  @ApiBody({ type: UpdatePromotionDto })
  @ApiResponse({ status: 200, type: PromotionResponseDto })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async update(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.update(placeId, id, req.user.id, req.user.role, dto);
  }

  @Delete('places/:placeId/promotions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promotion (owner or admin) — US-024' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiParam({ name: 'id', description: 'Promotion ID' })
  @ApiResponse({ status: 204, description: 'Promotion deleted' })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  async remove(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.promotionsService.remove(placeId, id, req.user.id, req.user.role);
  }
}
