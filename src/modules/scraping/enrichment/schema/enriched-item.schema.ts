import { z } from 'zod';

/**
 * Schema del item enriquecido por el LLM.
 *
 * Diseño:
 * - Todos los campos optativos son nullable (null = "no se pudo inferir").
 * - description tiene un cap de 500 chars para evitar payloads inflados.
 * - quality_score NO viene del LLM — lo calcula post-validation el QualityScorerService.
 * - Coercion suave en numericos (lat/lng/price) por si el LLM responde como string.
 */

const NullableString = (max?: number) => {
  const base = max ? z.string().max(max) : z.string();
  return base.nullable().optional();
};

const NullableNumber = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

const NullableISODate = z
  .string()
  .nullable()
  .optional()
  .refine(
    (v) => {
      if (v === null || v === undefined) return true;
      const d = new Date(v);
      return !Number.isNaN(d.getTime());
    },
    { message: 'invalid ISO date' },
  );

/**
 * Schema del payload que devuelve el LLM (antes de calcular quality_score).
 */
export const llmEnrichedItemSchema = z.object({
  title: z.string().min(1),
  description: NullableString(500),
  category_hint: NullableString(),
  location_name: NullableString(),
  lat: NullableNumber,
  lng: NullableNumber,
  starts_at: NullableISODate,
  ends_at: NullableISODate,
  price_cop: NullableNumber,
  image_url: NullableString(),
});

export type LlmEnrichedItem = z.infer<typeof llmEnrichedItemSchema>;

/**
 * Schema final del item enriquecido, ya con quality_score y source metadata.
 */
export const enrichedItemSchema = llmEnrichedItemSchema.extend({
  quality_score: z.number().min(0).max(1),
  source_kind: z.string(),
  raw_hash: z.string(),
});

export type EnrichedItem = z.infer<typeof enrichedItemSchema>;

/**
 * JSON schema para enviar al modelo via JSON mode de OpenAI.
 * Mantenemos sincronizado con llmEnrichedItemSchema arriba — la idea es que el LLM
 * SIEMPRE devuelva esta forma exacta, sin desviarse.
 */
export const llmResponseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    category_hint: { type: 'string', nullable: true },
    location_name: { type: 'string', nullable: true },
    lat: { type: 'number', nullable: true },
    lng: { type: 'number', nullable: true },
    starts_at: { type: 'string', nullable: true },
    ends_at: { type: 'string', nullable: true },
    price_cop: { type: 'number', nullable: true },
    image_url: { type: 'string', nullable: true },
  },
  required: ['title'],
};
