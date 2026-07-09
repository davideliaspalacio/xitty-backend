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

import { LocalPicksService } from './local-picks.service';
import { CreateLocalPickDto, PICK_TAGS } from './dto/create-local-pick.dto';
import { UpdateLocalPickDto } from './dto/update-local-pick.dto';
import {
  LocalPickResponseDto,
  LocalPickListResponseDto,
} from './dto/local-pick-response.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

interface AuthenticatedLocalPickRequest {
  user: {
    id: string;
    role: string;
  };
}

@ApiTags('local-picks')
@Controller()
export class LocalPicksController {
  constructor(private readonly localPicks: LocalPicksService) {}

  @Get('local-picks/current')
  @ApiOperation({
    summary: '"Disfruta como local" picks active this week — US-042',
  })
  @ApiQuery({ name: 'tag', required: false, enum: PICK_TAGS })
  @ApiResponse({ status: 200, type: [LocalPickResponseDto] })
  async findCurrent(@Query('tag') tag?: string) {
    return this.localPicks.findCurrent(tag);
  }

  @Get('local-picks')
  @ApiOperation({ summary: 'Paginated history of local picks — US-042' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: LocalPickListResponseDto })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.localPicks.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Post('admin/local-picks')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a local pick (admin) — US-042' })
  @ApiBody({ type: CreateLocalPickDto })
  @ApiResponse({ status: 201, type: LocalPickResponseDto })
  async create(
    @Request() req: AuthenticatedLocalPickRequest,
    @Body() dto: CreateLocalPickDto,
  ) {
    return this.localPicks.create(req.user.id, req.user.role, dto);
  }

  @Patch('admin/local-picks/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a local pick (admin) — US-042' })
  @ApiParam({ name: 'id', description: 'Local pick ID' })
  @ApiBody({ type: UpdateLocalPickDto })
  @ApiResponse({ status: 200, type: LocalPickResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedLocalPickRequest,
    @Body() dto: UpdateLocalPickDto,
  ) {
    return this.localPicks.update(id, req.user.role, dto);
  }

  @Delete('admin/local-picks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a local pick (admin) — US-042' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedLocalPickRequest,
  ) {
    return this.localPicks.remove(id, req.user.role);
  }
}
