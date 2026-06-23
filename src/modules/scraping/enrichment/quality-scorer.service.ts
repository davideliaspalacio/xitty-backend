import { Injectable } from '@nestjs/common';
import { LlmEnrichedItem } from './schema/enriched-item.schema';

/**
 * Calcula un quality_score en [0,1] para un item enriquecido.
 *
 * Reglas (suma):
 *  - title presente y no vacio         → 0.20
 *  - description con >100 chars utiles → 0.20
 *  - location_name presente            → 0.15
 *  - starts_at O ends_at presente      → 0.15
 *  - price_cop presente                → 0.15
 *  - image_url presente                → 0.15
 *  (max teorico = 1.0)
 *
 * El score final se clampa a [0,1] por seguridad.
 */
@Injectable()
export class QualityScorerService {
  score(item: LlmEnrichedItem): number {
    let s = 0;

    if (this.hasText(item.title)) s += 0.2;

    if (this.hasText(item.description) && item.description!.trim().length > 100) {
      s += 0.2;
    }

    if (this.hasText(item.location_name)) s += 0.15;

    if (this.hasText(item.starts_at) || this.hasText(item.ends_at)) s += 0.15;

    if (item.price_cop !== null && item.price_cop !== undefined) s += 0.15;

    if (this.hasText(item.image_url)) s += 0.15;

    // Clamp [0,1]
    if (s < 0) return 0;
    if (s > 1) return 1;
    return Math.round(s * 10000) / 10000;
  }

  private hasText(v: string | null | undefined): boolean {
    return typeof v === 'string' && v.trim().length > 0;
  }
}
