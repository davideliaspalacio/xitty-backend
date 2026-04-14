import {
  Controller,
  Get,
  Post,
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
  ApiParam,
} from '@nestjs/swagger';

import { FavoritesService } from './favorites.service';
import {
  FavoriteToggleResponseDto,
  FavoriteListResponseDto,
} from './dto/favorite-response.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('favorites')
@Controller()
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post('places/:placeId/favorite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle favorite on a place — US-015' })
  @ApiParam({ name: 'placeId', description: 'Place ID' })
  @ApiResponse({ status: 200, type: FavoriteToggleResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async toggle(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Request() req: any,
  ) {
    return this.favoritesService.toggle(placeId, req.user.id);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'List user favorites — US-015' })
  @ApiResponse({ status: 200, type: FavoriteListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findMine(@Request() req: any, @Query() pagination: PaginationDto) {
    return this.favoritesService.findByUserId(
      req.user.id,
      pagination.page,
      pagination.limit,
    );
  }
}
