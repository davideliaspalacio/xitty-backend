import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { LocationService } from './location.service';
import { SaveSnapshotsDto } from './dto/save-snapshots.dto';
import { LocationSnapshotDto } from './dto/location-snapshot.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('location')
@ApiBearerAuth()
@Controller('location')
@UseGuards(AuthGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post('snapshots')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Guardar batch de snapshots de ubicacion (max 10)',
  })
  @ApiBody({ type: SaveSnapshotsDto })
  @ApiResponse({
    status: 201,
    description: 'Snapshots guardados',
    schema: { example: { inserted: 2 } },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Request() req: any,
    @Body() dto: SaveSnapshotsDto,
  ): Promise<{ inserted: number }> {
    return this.locationService.saveSnapshots(req.user.id, dto);
  }

  @Delete('snapshots/mine')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Borrar todos los snapshots de ubicacion del usuario actual',
  })
  @ApiResponse({
    status: 200,
    description: 'Snapshots borrados',
    schema: { example: { deleted: true } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteMine(@Request() req: any): Promise<{ deleted: true }> {
    return this.locationService.deleteMine(req.user.id);
  }

  @Get('snapshots/latest')
  @ApiOperation({
    summary: 'Obtener el snapshot mas reciente del usuario (o null)',
  })
  @ApiResponse({
    status: 200,
    description: 'Snapshot mas reciente',
    type: LocationSnapshotDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLatest(
    @Request() req: any,
  ): Promise<LocationSnapshotDto | null> {
    return this.locationService.getLatest(req.user.id);
  }
}
