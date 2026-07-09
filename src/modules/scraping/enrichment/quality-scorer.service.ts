import { Injectable } from '@nestjs/common';
import { LlmEnrichedItem } from './schema/enriched-item.schema';

/**
 * Señales deterministas de la fuente (NO de la IA) que indican que un lugar es
 * real y activo. Las provee el pipeline a partir del RawItem.
 */
export interface QualitySignals {
  /** Rating 0..5 de la fuente (Google userRating). */
  rating?: number | null;
  /** Cantidad de reseñas — a más reseñas, más "real". */
  reviewCount?: number | null;
  /** La fuente trajo una foto. */
  hasImage?: boolean;
}

/**
 * Calcula un quality_score en [0,1] combinando:
 *  - Completitud del texto normalizado por la IA (título/descr/ubicación/precio).
 *  - Señales de REALIDAD de la fuente (rating, nº de reseñas, foto) — estas
 *    pesan fuerte: un lugar con muchas reseñas y foto es casi seguro real y útil.
 *
 * Reparto (máx 1.0):
 *   texto     → 0.40  (title .15 · descr .15 · location .10 · fecha/precio .10 combinado)
 *   foto      → 0.15
 *   rating    → 0.15  (proporcional a rating/5)
 *   reseñas   → 0.30  (escalonado por volumen)
 */
@Injectable()
export class QualityScorerService {
  score(item: LlmEnrichedItem, signals: QualitySignals = {}): number {
    let s = 0;

    // ── Texto / completitud (IA) ──────────────────────────────────────
    if (this.hasText(item.title)) s += 0.15;
    if (
      this.hasText(item.description) &&
      item.description!.trim().length > 80
    ) {
      s += 0.15;
    }
    if (this.hasText(item.location_name)) s += 0.1;
    if (
      this.hasText(item.starts_at) ||
      this.hasText(item.ends_at) ||
      (item.price_cop !== null && item.price_cop !== undefined)
    ) {
      s += 0.1;
    }

    // ── Señales de realidad (fuente, determinista) ────────────────────
    if (signals.hasImage) s += 0.15;

    if (typeof signals.rating === 'number' && signals.rating > 0) {
      s += Math.max(0, Math.min(0.15, (signals.rating / 5) * 0.15));
    }

    const rc =
      typeof signals.reviewCount === 'number' ? signals.reviewCount : 0;
    if (rc >= 500) s += 0.3;
    else if (rc >= 100) s += 0.22;
    else if (rc >= 20) s += 0.14;
    else if (rc >= 1) s += 0.06;

    // Clamp [0,1] con redondeo estable.
    return Math.round(Math.max(0, Math.min(1, s)) * 10000) / 10000;
  }

  private hasText(v: string | null | undefined): boolean {
    return typeof v === 'string' && v.trim().length > 0;
  }
}
