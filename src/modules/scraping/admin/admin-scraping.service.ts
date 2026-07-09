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
import { ListPlaceCompletenessQueryDto } from './dto/list-place-completeness-query.dto';
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
import { ScrapingExecutorService } from '../executor/scraping-executor.service';

const RAW_TABLE = 'scraped_items_raw';
const PLACES_TABLE = 'places';
const EXPERIENCES_TABLE = 'experiences';
const PLACE_COMPLETENESS_VIEW = 'place_data_completeness';
const COMPLETENESS_FIELDS = [
  'description',
  'address',
  'coordinates',
  'phone_or_whatsapp',
  'website',
  'schedule',
  'reviews',
  'photos',
  'cover_photo',
  'source_url',
] as const;

interface PublishedPlaceResult {
  id: string;
  created: boolean;
}

interface IdRow {
  id: string;
}

interface CountResult {
  count: number | null;
  error: { message: string } | null;
}

export interface PlaceCompletenessRow {
  id: string;
  name: string;
  city: string | null;
  zone: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  source_kind: string | null;
  source_external_id: string | null;
  source_url: string | null;
  photos_count: number;
  cover_photos_count: number;
  missing_fields: string[];
  missing_count: number;
  completeness_score: number;
  created_at: string;
  updated_at: string;
}

export interface PlaceCompletenessSummary {
  total_places: number;
  complete_places: number;
  incomplete_places: number;
  average_completeness_score: number;
  by_category: Array<{
    category_id: string | null;
    category_name: string;
    total_places: number;
    complete_places: number;
    incomplete_places: number;
    average_completeness_score: number;
  }>;
  fields: Array<{
    field: string;
    present_places: number;
    missing_places: number;
    completeness_percent: number;
  }>;
}

export interface PlaceCompletenessReport {
  data: PlaceCompletenessRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: PlaceCompletenessSummary;
}

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
    private readonly executor: ScrapingExecutorService,
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
      const result = (await this.supabase
        .from(RAW_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('source_id', sourceId)) as unknown as CountResult;
      if (result.error) return 0;
      return result.count ?? 0;
    } catch (err: unknown) {
      this.logger.warn(
        `countRawItems(${sourceId}) failed (ignored): ${errorMessage(err)}`,
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
      dto.enabled !== undefined ||
      dto.schedule_cron !== undefined ||
      dto.config !== undefined;
    if (!hasAny) {
      throw new BadRequestException(
        'patch requiere al menos un campo (enabled, schedule_cron, config)',
      );
    }
    return this.sourcesRepo.patch(id, dto);
  }

  // ── Runs ────────────────────────────────────────────────────────────────

  /**
   * Disparo manual de un run. Delega en el ScrapingExecutorService, que corre
   * el pipeline real contra la DB (sources → runs → raw → enrich → enriched).
   * El `triggeredBy` (id del admin) queda registrado en la fila de `scraping_runs`.
   */
  async runSourceNow(
    sourceId: string,
    triggeredBy: string,
  ): Promise<ScrapingRunRow> {
    this.logger.log(
      `runSourceNow source=${sourceId} triggered_by=${triggeredBy}`,
    );
    return this.executor.runSource(sourceId, triggeredBy);
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

  async listPlaceCompleteness(
    query: ListPlaceCompletenessQueryDto,
  ): Promise<PlaceCompletenessReport> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const summaryQuery = this.applyCompletenessFilters(
      this.supabase
        .from(PLACE_COMPLETENESS_VIEW)
        .select(
          'id, category_id, category_name, missing_fields, missing_count, completeness_score',
        )
        .limit(10000),
      query,
    );
    const summaryResult = await summaryQuery;
    if (summaryResult.error) {
      throw new BadRequestException(
        `Could not read place completeness summary: ${summaryResult.error.message}`,
      );
    }

    const listQuery = this.applyCompletenessFilters(
      this.supabase
        .from(PLACE_COMPLETENESS_VIEW)
        .select('*', { count: 'exact' })
        .order('completeness_score', { ascending: true, nullsFirst: false })
        .order('missing_count', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1),
      query,
    );
    const listResult = await listQuery;
    if (listResult.error) {
      throw new BadRequestException(
        `Could not read place completeness report: ${listResult.error.message}`,
      );
    }

    const allRows = normalizeCompletenessRows(summaryResult.data);
    const pageRows = normalizeCompletenessRows(listResult.data);
    const total = listResult.count ?? allRows.length;

    return {
      data: pageRows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: buildCompletenessSummary(allRows),
    };
  }

  private applyCompletenessFilters<QueryBuilder extends CompletenessQuery>(
    builder: QueryBuilder,
    query: ListPlaceCompletenessQueryDto,
  ): QueryBuilder {
    let qb = builder;
    if (query.city) qb = qb.eq('city', query.city);
    if (query.zone) qb = qb.eq('zone', query.zone);
    if (query.category_id) qb = qb.eq('category_id', query.category_id);
    if (query.missing_only) qb = qb.gt('missing_count', 0);
    return qb;
  }

  async patchItem(
    id: string,
    dto: UpdateScrapedItemDto,
  ): Promise<ScrapedItemEnriched> {
    await this.itemsRepo.findById(id);

    const fields: Partial<UpdateScrapedItemDto> = {};
    const allowed = [
      'title',
      'description',
      'category_hint',
      'location_name',
      'lat',
      'lng',
      'starts_at',
      'ends_at',
      'price_cop',
    ] as const;
    for (const key of allowed) {
      const value = dto[key];
      if (value !== undefined) {
        fields[key] = value as never;
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
      await this.attachCover('experience_photos', 'experience_id', expId, item);
      return this.itemsRepo.publish(id, { experienceId: expId });
    }
    const place = await this.insertPlace(item);
    if (place.created) {
      await this.attachCover('place_photos', 'place_id', place.id, item);
    }
    return this.itemsRepo.publish(id, { placeId: place.id });
  }

  /**
   * Adjunta la foto re-hospedada del item (image_url ya es una URL propia de
   * Storage, puesta en el enrichment) como cover del place/experience recién
   * creado. Best-effort: si falla, el publish NO se rompe — el lugar queda
   * publicado sin foto en vez de quedar a medias.
   */
  private async attachCover(
    table: 'place_photos' | 'experience_photos',
    fkField: 'place_id' | 'experience_id',
    ownerId: string,
    item: ScrapedItemEnriched,
  ): Promise<void> {
    if (!item.image_url) return;
    const { error } = await this.supabase.from(table).insert({
      [fkField]: ownerId,
      url: item.image_url,
      alt_text: item.title,
      is_cover: true,
      display_order: 0,
    });
    if (error) {
      this.logger.warn(
        `attachCover ${table}(${ownerId}) falló (ignorado): ${error.message}`,
      );
    }
  }

  private classify(categoryHint: string | null): 'place' | 'experience' {
    if (!categoryHint) return 'place';
    const normalized = categoryHint.trim().toLowerCase();
    return EXPERIENCE_HINTS.has(normalized) ? 'experience' : 'place';
  }

  private async insertPlace(
    item: ScrapedItemEnriched,
  ): Promise<PublishedPlaceResult> {
    const existingPlaceId = await this.findExistingPlaceForItem(item);
    if (existingPlaceId) {
      return { id: existingPlaceId, created: false };
    }

    const row = {
      name: item.title,
      description: item.description ?? null,
      address: item.location_name ?? null,
      latitude: item.lat ?? null,
      longitude: item.lng ?? null,
      // Perfil completo de la fuente (Google): contacto, horarios, precio.
      phone: item.phone ?? null,
      cta_phone: item.phone ?? null,
      website: item.website ?? null,
      price_range: item.price_level ?? null,
      city: item.city ?? null,
      zone: item.zone ?? null,
      schedule: item.opening_hours
        ? { weekday_descriptions: item.opening_hours }
        : null,
      // Semilla de reputación desde la fuente (luego se recalcula con reseñas propias).
      average_rating: item.rating ?? 0,
      total_reviews: item.review_count ?? 0,
      // Opiniones reales de la fuente (Google), display-only con atribución.
      source_reviews: item.source_reviews ?? null,
      source_kind: item.source_kind ?? null,
      source_external_id: item.source_external_id ?? null,
      source_url: item.source_url ?? null,
      data_provenance: this.buildPlaceProvenance(item),
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
    const place = data as IdRow;
    return { id: place.id, created: true };
  }

  private async findExistingPlaceForItem(
    item: ScrapedItemEnriched,
  ): Promise<string | null> {
    if (item.source_kind && item.source_external_id) {
      const { data, error } = await this.supabase
        .from(PLACES_TABLE)
        .select('id')
        .eq('source_kind', item.source_kind)
        .eq('source_external_id', item.source_external_id)
        .maybeSingle();

      if (error) {
        throw new BadRequestException(
          `Could not check place source identity: ${error.message}`,
        );
      }
      if (data) return (data as IdRow).id;
    }

    if (item.source_url) {
      const { data, error } = await this.supabase
        .from(PLACES_TABLE)
        .select('id')
        .eq('source_url', item.source_url)
        .maybeSingle();

      if (error) {
        throw new BadRequestException(
          `Could not check place source URL: ${error.message}`,
        );
      }
      if (data) return (data as IdRow).id;
    }

    return null;
  }

  private buildPlaceProvenance(
    item: ScrapedItemEnriched,
  ): Record<string, unknown> {
    const source = {
      kind: item.source_kind ?? null,
      external_id: item.source_external_id ?? null,
      url: item.source_url ?? null,
      enriched_item_id: item.id,
    };

    return {
      source,
      fields: {
        name: source,
        description: source,
        address: source,
        coordinates: source,
        city: source,
        zone: source,
        phone: source,
        website: source,
        opening_hours: source,
        price_level: source,
        rating: source,
        source_reviews: source,
      },
    };
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
    const experience = data as IdRow;
    return experience.id;
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface CompletenessQuery {
  eq(column: string, value: unknown): this;
  gt(column: string, value: unknown): this;
}

function normalizeCompletenessRows(data: unknown): PlaceCompletenessRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => normalizeCompletenessRow(row));
}

function normalizeCompletenessRow(input: unknown): PlaceCompletenessRow {
  const row = (input ?? {}) as Partial<
    Record<keyof PlaceCompletenessRow, unknown>
  >;
  const missingFields = Array.isArray(row.missing_fields)
    ? row.missing_fields.filter(
        (field): field is string => typeof field === 'string',
      )
    : [];
  const score = Number(row.completeness_score ?? 0);
  const missingCount = Number(row.missing_count ?? missingFields.length);

  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    city: nullableString(row.city),
    zone: nullableString(row.zone),
    category_id: nullableString(row.category_id),
    category_name: nullableString(row.category_name),
    category_slug: nullableString(row.category_slug),
    source_kind: nullableString(row.source_kind),
    source_external_id: nullableString(row.source_external_id),
    source_url: nullableString(row.source_url),
    photos_count: Number(row.photos_count ?? 0),
    cover_photos_count: Number(row.cover_photos_count ?? 0),
    missing_fields: missingFields,
    missing_count: Number.isFinite(missingCount)
      ? missingCount
      : missingFields.length,
    completeness_score: Number.isFinite(score) ? score : 0,
    created_at: stringValue(row.created_at),
    updated_at: stringValue(row.updated_at),
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function buildCompletenessSummary(
  rows: PlaceCompletenessRow[],
): PlaceCompletenessSummary {
  const total = rows.length;
  const complete = rows.filter((row) => row.missing_count === 0).length;
  const average = averageScore(rows);

  const categoryMap = new Map<
    string,
    {
      category_id: string | null;
      category_name: string;
      rows: PlaceCompletenessRow[];
    }
  >();
  for (const row of rows) {
    const key = row.category_id ?? 'uncategorized';
    const entry = categoryMap.get(key) ?? {
      category_id: row.category_id,
      category_name: row.category_name ?? 'Sin categoria',
      rows: [],
    };
    entry.rows.push(row);
    categoryMap.set(key, entry);
  }

  return {
    total_places: total,
    complete_places: complete,
    incomplete_places: total - complete,
    average_completeness_score: average,
    by_category: Array.from(categoryMap.values())
      .map((entry) => {
        const totalPlaces = entry.rows.length;
        const completePlaces = entry.rows.filter(
          (row) => row.missing_count === 0,
        ).length;
        return {
          category_id: entry.category_id,
          category_name: entry.category_name,
          total_places: totalPlaces,
          complete_places: completePlaces,
          incomplete_places: totalPlaces - completePlaces,
          average_completeness_score: averageScore(entry.rows),
        };
      })
      .sort((a, b) => b.incomplete_places - a.incomplete_places),
    fields: COMPLETENESS_FIELDS.map((field) => {
      const missing = rows.filter((row) =>
        row.missing_fields.includes(field),
      ).length;
      const present = total - missing;
      return {
        field,
        present_places: present,
        missing_places: missing,
        completeness_percent:
          total === 0 ? 0 : roundTwo((present / total) * 100),
      };
    }),
  };
}

function averageScore(rows: PlaceCompletenessRow[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, row) => acc + row.completeness_score, 0);
  return roundTwo(sum / rows.length);
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}
