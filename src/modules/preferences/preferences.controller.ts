import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

import { PreferencesService } from './preferences.service';
import { CreatePreferencesDto } from './dto/create-preferences.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PreferencesResponseDto } from './dto/preferences-response.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('preferences')
@ApiBearerAuth()
@Controller('preferences')
@UseGuards(AuthGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save preferences (wizard completed) — US-002',
  })
  @ApiBody({ type: CreatePreferencesDto })
  @ApiResponse({
    status: 201,
    description: 'Preferences saved',
    type: PreferencesResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Request() req: any,
    @Body() dto: CreatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    return this.preferencesService.upsert(req.user.id, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user preferences (default if missing)',
  })
  @ApiResponse({ status: 200, type: PreferencesResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Request() req: any): Promise<PreferencesResponseDto> {
    return this.preferencesService.getByUserId(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Partial update of user preferences — US-003' })
  @ApiBody({ type: UpdatePreferencesDto })
  @ApiResponse({ status: 200, type: PreferencesResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Preferences not found — create them first',
  })
  async updateMe(
    @Request() req: any,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    return this.preferencesService.update(req.user.id, dto);
  }

  @Post('skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Skip the preferences wizard (idempotent)',
  })
  @ApiResponse({ status: 200, type: PreferencesResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async skip(@Request() req: any): Promise<PreferencesResponseDto> {
    return this.preferencesService.skip(req.user.id);
  }
}
