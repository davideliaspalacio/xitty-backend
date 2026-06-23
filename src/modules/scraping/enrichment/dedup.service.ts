import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { LlmEnrichedItem } from './schema/enriched-item.schema';

/**
 * Calcula hashes deterministicos y busca duplicados en la tabla
 * `scraped_items_raw` antes de persistir un nuevo item enriquecido.
 *
 * Estrategia: SHA-256 sobre `<title-normalizado>|<location-normalizada>|<fecha-normalizada>`.
 * Normalizacion: lowercase + trim + colapso de whitespace + strip de acentos.
 */
@Injectable()
export class DedupService {
  private readonly logger = new Logger(DedupService.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  computeHash(item: LlmEnrichedItem): string {
    const title = this.normalize(item.title);
    const location = this.normalize(item.location_name);
    // Solo usamos starts_at para el hash (la fecha "principal" del item).
    const date = this.normalizeDate(item.starts_at);
    const payload = `${title}|${location}|${date}`;
    return createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  async findDuplicate(hash: string): Promise<any | null> {
    try {
      const { data, error } = await this.supabase
        .from('scraped_items_raw')
        .select('*')
        .eq('raw_hash', hash)
        .maybeSingle();

      if (error) {
        this.logger.warn(`dedup lookup failed: ${error.message}`);
        return null;
      }
      return data ?? null;
    } catch (err: any) {
      this.logger.warn(`dedup lookup threw: ${err?.message ?? 'unknown'}`);
      return null;
    }
  }

  private normalize(v: string | null | undefined): string {
    if (!v) return '';
    return v
      .toString()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacritics
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  private normalizeDate(v: string | null | undefined): string {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return this.normalize(v);
    // ISO truncado a granularidad de minuto para evitar variaciones por segundos/ms.
    return d.toISOString().slice(0, 16);
  }
}
