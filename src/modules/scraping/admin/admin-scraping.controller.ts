import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AdminScrapingService } from './admin-scraping.service';
import { CreateScrapingSourceDto } from './dto/create-source.dto';
import { UpdateScrapingSourceDto } from './dto/update-source.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';
import { ListPlaceCompletenessQueryDto } from './dto/list-place-completeness-query.dto';
import { ListRunsQueryDto } from './dto/list-runs-query.dto';
import { UpdateScrapedItemDto } from './dto/update-item.dto';
import { RejectScrapedItemDto } from './dto/reject-item.dto';

import { AuthGuard } from '../../../common/guards/auth.guard';

interface AuthenticatedAdminRequest {
  user?: {
    id?: string;
    role?: string;
  };
}

interface VerifiedAdminRequest {
  user: {
    id: string;
    role: 'admin';
  };
}

/**
 * Panel de moderacion de scraping. Todos los endpoints requieren:
 *  1. Bearer token valido (AuthGuard)
 *  2. role === 'admin'
 *
 * El check de role se hace inline en cada handler (mismo patron que
 * `/auth/admin/users`) para evitar acoplar a un decorador propio.
 */
@ApiTags('admin-scraping')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('admin/scraping')
export class AdminScrapingController {
  constructor(private readonly adminService: AdminScrapingService) {}

  // ── Sources ────────────────────────────────────────────────────────────

  @Get('sources')
  @ApiOperation({ summary: 'Lista sources con last_run y items_count' })
  @ApiResponse({ status: 200, description: 'Lista de sources' })
  @ApiResponse({ status: 403, description: 'Admin requerido' })
  async listSources(@Request() req: AuthenticatedAdminRequest) {
    this.assertAdmin(req);
    return this.adminService.listSources();
  }

  @Post('sources')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crea o upsert una source (por name unico)',
  })
  @ApiResponse({ status: 201, description: 'Source creada/actualizada' })
  async upsertSource(
    @Request() req: AuthenticatedAdminRequest,
    @Body() dto: CreateScrapingSourceDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.upsertSource(dto);
  }

  @Patch('sources/:id')
  @ApiOperation({
    summary: 'Toggle enabled / cambiar schedule / config de una source',
  })
  @ApiResponse({ status: 200, description: 'Source actualizada' })
  @ApiResponse({ status: 404, description: 'Source no encontrada' })
  async patchSource(
    @Request() req: AuthenticatedAdminRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateScrapingSourceDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.patchSource(id, dto);
  }

  @Post('sources/:id/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Dispara un run manual para esa source' })
  @ApiResponse({ status: 202, description: 'Run summary' })
  @ApiResponse({ status: 404, description: 'Source no encontrada / disabled' })
  async runSource(
    @Request() req: AuthenticatedAdminRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.runSourceNow(id, req.user.id);
  }

  // ── Runs ───────────────────────────────────────────────────────────────

  @Get('runs')
  @ApiOperation({ summary: 'Historial de runs (filtrable por source)' })
  async listRuns(
    @Request() req: AuthenticatedAdminRequest,
    @Query() query: ListRunsQueryDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.listRuns(query);
  }

  // ── Items (moderation queue) ───────────────────────────────────────────

  @Get('items')
  @ApiOperation({ summary: 'Cola de moderacion (default status=pending)' })
  async listItems(
    @Request() req: AuthenticatedAdminRequest,
    @Query() query: ListItemsQueryDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.listItems(query);
  }

  @Get('place-completeness')
  @ApiOperation({
    summary: 'Reporte admin de completitud de datos de lugares publicados',
  })
  @ApiResponse({ status: 200, description: 'Reporte de calidad de datos' })
  @ApiResponse({ status: 403, description: 'Admin requerido' })
  async listPlaceCompleteness(
    @Request() req: AuthenticatedAdminRequest,
    @Query() query: ListPlaceCompletenessQueryDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.listPlaceCompleteness(query);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Detalle de un item enriched' })
  @ApiResponse({ status: 404, description: 'Item no encontrado' })
  async getItem(
    @Request() req: AuthenticatedAdminRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.findItem(id);
  }

  @Patch('items/:id')
  @ApiOperation({
    summary: 'Edita campos del item antes de approve/publish',
  })
  @ApiResponse({ status: 200, description: 'Item actualizado' })
  @ApiResponse({ status: 404, description: 'Item no encontrado' })
  async patchItem(
    @Request() req: AuthenticatedAdminRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateScrapedItemDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.patchItem(id, dto);
  }

  @Post('items/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mueve el item a status=approved' })
  async approveItem(
    @Request() req: AuthenticatedAdminRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.approveItem(id, req.user.id);
  }

  @Post('items/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mueve el item a status=rejected con razon' })
  async rejectItem(
    @Request() req: AuthenticatedAdminRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectScrapedItemDto,
  ) {
    this.assertAdmin(req);
    return this.adminService.rejectItem(id, req.user.id, dto.reason);
  }

  @Post('items/:id/publish')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Crea place o experience segun category_hint y marca el item como published',
  })
  @ApiResponse({ status: 201, description: 'Item publicado' })
  @ApiResponse({
    status: 400,
    description: 'Item rejected, ya publicado, o falla al crear entidad',
  })
  async publishItem(
    @Request() req: AuthenticatedAdminRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.assertAdmin(req);
    return this.adminService.publishItem(id);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private assertAdmin(
    req: AuthenticatedAdminRequest,
  ): asserts req is VerifiedAdminRequest {
    if (!req?.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
  }
}
