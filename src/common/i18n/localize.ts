/**
 * i18n helpers for translating catalog records.
 *
 * Strategy: each translatable table has a `translations jsonb` column with the
 * shape:
 *   {
 *     "en": { "name": "...", "description": "..." },
 *     "fr": { ... },
 *     ...
 *   }
 *
 * The base language is Spanish ("es"). For any other supported language we
 * shallow-merge the language entry on top of the record, overriding the
 * translatable fields (typically `name`/`title` and `description`).
 *
 * This module has zero dependencies on NestJS or Supabase so it can be used
 * from services, controllers, or tests directly.
 */

export const SUPPORTED_LANGS = ['es', 'en', 'fr', 'pt'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: SupportedLang = 'es';

const TRANSLATABLE_FIELDS = ['name', 'title', 'description'] as const;

type TranslatableField = (typeof TRANSLATABLE_FIELDS)[number];
type TranslationEntry = Partial<Record<TranslatableField, string>>;

interface TranslatableRecord {
  translations?: Record<string, TranslationEntry> | null;
  [key: string]: unknown;
}

/**
 * Returns a localized copy of `record` for the requested `lang`.
 *
 * Rules:
 *   - lang is "es" (the base language), null, or undefined → return record as-is
 *   - record has no translations object → return record as-is
 *   - translations[lang] missing → return record as-is
 *   - otherwise → shallow merge translations[lang] on top of record (only
 *     overrides the keys present in that entry; original is not mutated)
 */
export function localize<T extends TranslatableRecord>(
  record: T,
  lang: string | null | undefined,
): T {
  if (!record) return record;
  if (!lang || lang === DEFAULT_LANG) return record;

  const translations = record.translations;
  if (!translations || typeof translations !== 'object') return record;

  const entry = translations[lang];
  if (!entry || typeof entry !== 'object') return record;

  const overrides: Partial<Record<TranslatableField, string>> = {};
  for (const field of TRANSLATABLE_FIELDS) {
    const value = entry[field];
    if (typeof value === 'string' && value.length > 0) {
      overrides[field] = value;
    }
  }

  if (Object.keys(overrides).length === 0) return record;

  return { ...record, ...overrides };
}

/**
 * Parses the Accept-Language header into a normalized two-letter code.
 * Picks the first listed language regardless of quality factor (clients send
 * them in preference order already).
 */
function parseAcceptLanguage(header: string | undefined): string | null {
  if (!header || typeof header !== 'string') return null;
  const first = header.split(',')[0]?.trim();
  if (!first) return null;
  // Strip ";q=..." and any region suffix ("en-US" → "en")
  const code = first.split(';')[0]?.trim().split('-')[0]?.toLowerCase();
  return code || null;
}

function normalize(value: unknown): SupportedLang | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(trimmed)
    ? (trimmed as SupportedLang)
    : null;
}

/**
 * Extracts the requested language from an Express-like request.
 *
 * Resolution order:
 *   1. `req.query.lang` (explicit override)
 *   2. `Accept-Language` header (first listed language, region stripped)
 *   3. DEFAULT_LANG ("es")
 *
 * Unknown / unsupported languages fall back to DEFAULT_LANG.
 */
export function getLang(req: {
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): SupportedLang {
  const fromQuery = normalize(req?.query?.lang);
  if (fromQuery) return fromQuery;

  const acceptLanguage =
    req?.headers?.['accept-language'] ?? req?.headers?.['Accept-Language'];
  const fromHeader = normalize(
    parseAcceptLanguage(
      typeof acceptLanguage === 'string' ? acceptLanguage : undefined,
    ),
  );
  if (fromHeader) return fromHeader;

  return DEFAULT_LANG;
}
