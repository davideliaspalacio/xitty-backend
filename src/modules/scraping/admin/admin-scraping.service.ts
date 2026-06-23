import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { CreateScrapingSourceDto } from './dto/create-source.dto';
import { UpdateScrapingSourceDto } from './dto/update-source.dto';
import { ListItemsQueryDto } from './dto/list-items-query.dto';
import { ListRunsQueryDto } from './dto/list-runs-query.dto';
import { UpdateScrapedItemDto } from './dto/update-item.dto';

import {
  ScrapingSourcesRepo,
  ScrapingSource,
} from '../storage/scraping-sources.repo';
import {
  ScrapingRunsRepo,
  ScrapingRun as ScrapingRunRow,
} from '../storage/scraping-runs.repo';
import {
  ScrapedItemsRepo,
  ScrapedItemEnriched,
} from '../storage/scraped-items.repo';
import { RunnerService } from '../scheduler/runner.service';
import type { ScrapingRun as RunSummary } from '../scraper-source.interface';

const RAW_TABLE = 'scraped_items_raw';
const PLACES_TABLE = 'places';
const EXPERIENCES_TABLE = 'experiences';

/**
 * Categorias de hint que se mapean a `experiences`. El resto cae en `places`
 * por default — places es el tipo "lugar fisico" y experiences es la cosa
 * con horario / cupo (tours, eventos, workshops, ...).
 */
const EXPERIENCE_HINTS = new Set<string>([
  'tour',
  'tours',
  'evento',
  'eventos',
  'event',
  'events',
  'experiencia',
  'experiencias',
  'experience',
  'workshop',
  'workshops',
  'taller',
  'talleres',
]);

export interface SourceWithMeta extends ScrapingSource {
  /** Cantidad de raw items que esta source ha producido en su historia. */
  items_count: number;
}

@Injectable()
export class AdminScrapingService {
  private readonly logger = new Logger(AdminScrapingService.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    private readonly sourcesRepo: ScrapingSourcesRepo,
    private readonly runsRepo: ScrapingRunsRepo,
    private readonly itemsRepo: ScrapedItemsRepo,
    private readonly runner: RunnerService,
  ) {}

  // ── Sources ─────────────────────────────────────────────────────────────

  /**
   * Lista de sources con metadata agregada (last_run_at ya viene del row,
   * items_count se cuenta aparte sobre `scraped_items_raw`).
   *
   * El conteo es best-effort: si falla por cualquier source, ese conteo
   * cae a 0 y la lista igual se devuelve.
   */
  async listSources(): Promise<SourceWithMeta[]> {
    const sources = await this.sourcesRepo.findAll();

    const withCounts = await Promise.all(
      sources.map(async (s) => ({
        ...s,
        items_count: await this.countRawItems(s.id),
      })),
    );
    return withCounts;
  }

  private async countRawItems(sourceId: string): Promise<number> {
    try {
      const { count, error } = (await this.supabase
        .from(RAW_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('source_id', sourceId)) as any;
      if (error) return 0;
      return count ?? 0;
    } catch (err: any) {
      this.logger.warn(
        `countRawItems(${sourceId}) failed (ignored): ${err?.message ?? err}`,
      );
      return 0;
    }
  }

  async upsertSource(dto: CreateScrapingSourceDto): Promise<ScrapingSource> {
    return this.sourcesRepo.upsert({
      name: dto.name,
      kind: dto.kind,
      config: dto.config ?? {},
      enabled: dto.enabled ?? true,
      schedule_cron: dto.schedule_cron ?? null,
    });
  }

  async patchSource(
    id: string,
    dto: UpdateScrapingSourceDto,
  ): Promise<ScrapingSource> {
    // findById para devolver 404 (en lugar de un BadRequest opaco) si no existe
    await this.sourcesRepo.findById(id);

    const hasAny =
      dto.enabled !== undefined
      || dto.schedule_cron !== undefined
      || dto.config !== undefined;
    if (!hasAny) {
      throw new BadRequestException(
        'patch requiere al menos un campo (enabled, schedule_cron, config)',
      );
    }
    return this.sourcesRepo.patch(id, dto);
  }

  // ── Runs ────────────────────────────────────────────────────────────────

  /**
   * Disparo manual de un run. Delega 100% al RunnerService — el reviewer
   * (admin) se loguea como `triggered_by` solo a nivel logger; el runner
   * tiene su propio metadata.
   */
  async runSourceNow(sourceId: string, triggeredBy: string): Promise<RunSummary> {
    this.logger.log(
      `runSourceNow source=${sourceId} triggered_by=${triggeredBy}`,
    );
    return this.runner.runSource(sourceId);
  }

  async listRuns(query: ListRunsQueryDto): Promise<ScrapingRunRow[]> {
    return this.runsRepo.listBySource({
      sourceId: query.source_id,
      limit: query.limit ?? 50,
    });
  }

  // ── Items (moderation queue) ────────────────────────────────────────────

  async listItems(query: ListItemsQueryDto): Promise<ScrapedItemEnriched[]> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;
    return this.itemsRepo.listByStatus({
      status: query.status ?? 'pending',
      limit,
      offset,
    });
  }

  async findItem(id: string): Promise<ScrapedItemEnriched> {
    return this.itemsRepo.findById(id);
  }

  async patchItem(
    id: string,
    dto: UpdateScrapedItemDto,
  ): Promise<ScrapedItemEnriched> {
    await this.itemsRepo.findById(id);

    const fields: Record<string, any> = {};
    const allowed = [
      'title', 'description', 'category_hint', 'location_name',
      'lat', 'lng', 'starts_at', 'ends_at', 'price_cop',
    ] as const;
    for (const key of allowed) {
      if ((dto as any)[key] !== undefined) {
        fields[key] = (dto as any)[key];
      }
    }
    if (Object.keys(fields).length === 0) {
      throw new BadRequestException(
        'patchItem requiere al menos un campo editable',
      );
    }
    return this.itemsRepo.updateFields(id, fields);
  }

  async approveItem(
    id: string,
    reviewerId: string,
  ): Promise<ScrapedItemEnriched> {
    return this.itemsRepo.approve(id, reviewerId);
  }

  async rejectItem(
    id: string,
    reviewerId: string,
    reason?: string,
  ): Promise<ScrapedItemEnriched> {
    return this.itemsRepo.reject(id, reviewerId, reason);
  }

  // ── Publish ─────────────────────────────────────────────────────────────

  /**
   * Crea un place o experience segun `category_hint` y enlaza el id en
   * `published_*` via `itemsRepo.publish(...)`.
   *
   * Reglas:
   *  - hints "tour", "evento", "workshop", "experiencia" → experience
   *  - todo lo demas (incluido null) → place
   *
   * Si el insert en places/experiences falla, NO se marca el item como
   * `published` — el caller recibe el error y el item queda en su estado
   * anterior (approved). Esto evita el caso "marcado como publicado pero
   * sin entidad real detras".
   *
   * El item debe estar en status `pending` o `approved`. Si esta `rejected`
   * o ya `published`, se rechaza para evitar duplicados accidentales.
   */
  async publishItem(id: string): Promise<ScrapedItemEnriched> {
    const item = await this.itemsRepo.findById(id);

    if (item.status === 'rejected') {
      throw new BadRequestException(
        `Cannot publish item ${id} — current status is "rejected". Approve it first.`,
      );
    }
    if (item.status === 'published') {
      throw new BadRequestException(
        `Item ${id} is already published (place_id=${item.published_place_id ?? 'null'}, experience_id=${item.published_experience_id ?? 'null'})`,
      );
    }

    const target = this.classify(item.category_hint);
    if (target === 'experience') {
      const expId = await this.insertExperience(item);
      return this.itemsRepo.publish(id, { experienceId: expId });
    }
    const placeId = await this.insertPlace(item);
    return this.itemsRepo.publish(id, { placeId });
  }

  private classify(categoryHint: string | null): 'place' | 'experience' {
    if (!categoryHint) return 'place';
    const normalized = categoryHint.trim().toLowerCase();
    return EXPERIENCE_HINTS.has(normalized) ? 'experience' : 'place';
  }

  private async insertPlace(item: ScrapedItemEnriched): Promise<string> {
    const row = {
      name: item.title,
      description: item.description ?? null,
      address: item.location_name ?? null,
      latitude: item.lat ?? null,
      longitude: item.lng ?? null,
      tags: item.category_hint ? [item.category_hint] : [],
      is_active: true,
    };

    const { data, error } = await this.supabase
      .from(PLACES_TABLE)
      .insert(row)
      .select('id')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Could not create place from item ${item.id}: ${error?.message ?? 'unknown error'}`,
      );
    }
    return (data as any).id;
  }

  private async insertExperience(item: ScrapedItemEnriched): Promise<string> {
    const durationMin = this.computeDurationMinutes(
      item.starts_at,
      item.ends_at,
    );

    const row = {
      title: item.title,
      description: item.description ?? null,
      // experience_type es libre en este insert — el schema requiere un valor
      // del enum (`tour`, `workshop`, ...), asi que mapeamos por hint.
      experience_type: this.mapExperienceType(item.category_hint),
      duration_minutes: durationMin,
      price_cop: item.price_cop ?? 0,
      meeting_point_address: item.location_name ?? null,
      meeting_point_latitude: item.lat ?? null,
      meeting_point_longitude: item.lng ?? null,
      is_active: true,
    };

    const { data, error } = await this.supabase
      .from(EXPERIENCES_TABLE)
      .insert(row)
      .select('id')
      .single();

    if (error || !data) {
      throw new BadRequestException(
        `Could not create experience from item ${item.id}: ${error?.message ?? 'unknown error'}`,
      );
    }
    return (data as any).id;
  }

  private computeDurationMinutes(
    startsAt: string | null,
    endsAt: string | null,
  ): number {
    if (!startsAt || !endsAt) return 60;
    const startMs = Date.parse(startsAt);
    const endMs = Date.parse(endsAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return 60;
    }
    return Math.round((endMs - startMs) / 60000);
  }

  private mapExperienceType(hint: string | null): string {
    if (!hint) return 'tour';
    const normalized = hint.trim().toLowerCase();
    if (normalized.includes('workshop') || normalized.includes('taller')) {
      return 'workshop';
    }
    if (normalized.includes('event')) {
      return 'cultural';
    }
    return 'tour';
  }
}
