import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthGuard } from '../../common/guards/auth.guard';
import { AudioToursService } from './audio-tours.service';
import { AudioTourQueryDto } from './dto/audio-tour-query.dto';
import { UpdateAudioTourProgressDto } from './dto/update-audio-tour-progress.dto';
import {
  AudioTourDto,
  AudioTourListResponseDto,
  AudioTourProgressDto,
} from './dto/audio-tour-response.dto';

interface AuthenticatedRequest {
  user: {
    id: string;
  };
}

@ApiTags('audio-tours')
@Controller('audio-tours')
export class AudioToursController {
  constructor(private readonly audioTours: AudioToursService) {}

  @Get('places/:placeId')
  @ApiOperation({
    summary: 'List active audio tours for a place',
  })
  @ApiParam({ name: 'placeId', description: 'Place id' })
  @ApiResponse({ status: 200, type: AudioTourListResponseDto })
  async findByPlace(
    @Param('placeId', ParseUUIDPipe) placeId: string,
    @Query() query: AudioTourQueryDto,
  ): Promise<AudioTourListResponseDto> {
    return this.audioTours.findByPlace(placeId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an active audio tour with ordered stops',
  })
  @ApiResponse({ status: 200, type: AudioTourDto })
  @ApiResponse({ status: 404, description: 'Audio tour not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AudioTourDto> {
    return this.audioTours.findById(id);
  }

  @Get(':id/progress')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my progress for an audio tour',
  })
  @ApiResponse({ status: 200, type: AudioTourProgressDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<AudioTourProgressDto | null> {
    return this.audioTours.getProgress(req.user.id, id);
  }

  @Patch(':id/progress')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Save my progress for an audio tour',
  })
  @ApiBody({ type: UpdateAudioTourProgressDto })
  @ApiResponse({ status: 200, type: AudioTourProgressDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateAudioTourProgressDto,
  ): Promise<AudioTourProgressDto> {
    return this.audioTours.updateProgress(req.user.id, id, dto);
  }
}
