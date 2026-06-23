import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'scraping_runs';
const MAX_ERROR_LENGTH = 2000;

export type ScrapingRunStatus =
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'partial';

export interface ScrapingRun {
  id: string;
  source_id: string;
  status: ScrapingRunStatus;
  triggered_by: string | null;
  items_found: number;
  items_enriched: number;
  items_failed: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface FinishRunInput {
  status: 'succeeded' | 'partial';
  itemsFound: number;
  itemsEnriched: number;
  itemsFailed: number;
}

const SELECT_COLS =
  'id, source_id, status, triggered_by, items_found, items_enriched, items_failed, error, started_at, finished_at';

@Injectable()
export class ScrapingRunsRepo {
  private readonly logger = new Logger(ScrapingRunsRepo.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Historial de runs. Si `sourceId` no se pasa, devuelve runs de todas las
   * sources, ordenados por mas reciente primero. `limit` clamp [1, 200].
   */
  async listBySource(opts: {
    sourceId?: string;
    limit?: number;
  }): Promise<ScrapingRun[]> {
    const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));

    let qb: any = this.supabase
      .from(TABLE)
      .select(SELECT_COLS)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (opts.sourceId) {
      qb = qb.eq('source_id', opts.sourceId);
    }

    const { data, error } = await qb;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as ScrapingRun[];
  }

  async start(sourceId: string, triggeredBy: string): Promise<ScrapingRun> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .insert({
        source_id: sourceId,
        status: 'running',
        triggered_by: triggeredBy,
      })
      .select(SELECT_COLS)
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'No se pudo iniciar el run',
      );
    }
    return data as ScrapingRun;
  }

  async finish(runId: string, input: FinishRunInput): Promise<void> {
    const { error } = await this.supabase
      .from(TABLE)
      .update({
        status: input.status,
        items_found: input.itemsFound,
        items_enriched: input.itemsEnriched,
        items_failed: input.itemsFailed,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);

    if (error) throw new BadRequestException(error.message);
  }

  /**
   * Best-effort: marca el run como failed. No tira para no enmascarar el error
   * original que el pipeline esta intentando reportar.
   */
  async error(runId: string, message: string): Promise<void> {
    const truncated =
      message.length > MAX_ERROR_LENGTH
        ? message.slice(0, MAX_ERROR_LENGTH)
        : message;

    const { error } = await this.supabase
      .from(TABLE)
      .update({
        status: 'failed',
        error: truncated,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);

    if (error) {
      this.logger.warn(
        `error(${runId}) failed to persist (ignored): ${error.message}`,
      );
    }
  }
}
