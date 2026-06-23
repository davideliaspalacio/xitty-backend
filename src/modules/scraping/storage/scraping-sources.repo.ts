import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'scraping_sources';

export type ScrapingSourceKind =
  | 'google_places'
  | 'eventbrite'
  | 'tavily'
  | 'firecrawl'
  | 'manual';

export interface ScrapingSource {
  id: string;
  name: string;
  kind: ScrapingSourceKind;
  config: Record<string, any>;
  enabled: boolean;
  schedule_cron: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertScrapingSourceInput {
  name: string;
  kind: ScrapingSourceKind;
  config: Record<string, any>;
  enabled: boolean;
  schedule_cron?: string | null;
}

export interface PatchScrapingSourceInput {
  enabled?: boolean;
  schedule_cron?: string | null;
  config?: Record<string, any>;
}

export interface FindAllOptions {
  enabledOnly?: boolean;
}

const SELECT_COLS =
  'id, name, kind, config, enabled, schedule_cron, last_run_at, created_at, updated_at';

@Injectable()
export class ScrapingSourcesRepo {
  private readonly logger = new Logger(ScrapingSourcesRepo.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async findAll(opts: FindAllOptions = {}): Promise<ScrapingSource[]> {
    let query: any = this.supabase
      .from(TABLE)
      .select(SELECT_COLS)
      .order('name', { ascending: true });

    if (opts.enabledOnly) {
      query = query.eq('enabled', true);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as ScrapingSource[];
  }

  async findById(id: string): Promise<ScrapingSource> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select(SELECT_COLS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Scraping source ${id} not found`);
    return data as ScrapingSource;
  }

  async upsert(input: UpsertScrapingSourceInput): Promise<ScrapingSource> {
    const row = {
      name: input.name,
      kind: input.kind,
      config: input.config ?? {},
      enabled: input.enabled,
      schedule_cron: input.schedule_cron ?? null,
    };

    const { data, error } = await this.supabase
      .from(TABLE)
      .upsert(row, { onConflict: 'name' })
      .select(SELECT_COLS)
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'No se pudo guardar la source',
      );
    }
    return data as ScrapingSource;
  }

  /**
   * PATCH parcial de una source ya existente (admin panel). Solo aplica los
   * campos definidos en `patch` — los undefined NO se tocan. Tira NotFound si
   * el id no existe.
   */
  async patch(
    id: string,
    patch: PatchScrapingSourceInput,
  ): Promise<ScrapingSource> {
    const updates: Record<string, any> = {};
    if (patch.enabled !== undefined) updates.enabled = patch.enabled;
    if (patch.schedule_cron !== undefined) {
      updates.schedule_cron = patch.schedule_cron;
    }
    if (patch.config !== undefined) updates.config = patch.config;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'patch requiere al menos un campo (enabled, schedule_cron, config)',
      );
    }

    const { data, error } = await this.supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .select(SELECT_COLS)
      .single();

    if (error || !data) {
      // single() devuelve PGRST116 cuando no encuentra fila
      const code = (error as any)?.code as string | undefined;
      const message = (error as any)?.message as string | undefined;
      if (code === 'PGRST116' || !data) {
        throw new NotFoundException(`Scraping source ${id} not found`);
      }
      throw new BadRequestException(
        message ?? 'No se pudo actualizar la source',
      );
    }
    return data as ScrapingSource;
  }

  /**
   * Best-effort: marca last_run_at = now(). No tira si falla; el caller (cron)
   * no debe abortar el pipeline porque un metadato no se actualizo.
   */
  async markRun(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(TABLE)
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      this.logger.warn(
        `markRun(${id}) failed (ignored): ${error.message}`,
      );
    }
  }
}
