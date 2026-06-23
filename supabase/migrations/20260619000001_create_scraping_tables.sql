-- ============================================================================
-- Xitty Discover — Scraping pipeline storage
-- ============================================================================
-- Cuatro tablas:
--   1) scraping_sources         — fuentes configurables (admin)
--   2) scraping_runs            — log de invocaciones del pipeline (cron/manual)
--   3) scraped_items_raw        — payload bruto de la fuente (append-only)
--   4) scraped_items_enriched   — normalizado por LLM, pasa por moderacion
--
-- Flujo:
--   source  →  run  →  raw items  →  LLM enrich  →  enriched item (pending)
--   enriched item (pending) → admin approve/reject → published al frontend
--
-- RLS: el frontend lee `enriched` solo cuando status='published'. Todo lo
-- demas requiere admin (en la app, validado en el controller; en DB, el
-- backend bypassea con service_role).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1) scraping_sources
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scraping_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  kind          text NOT NULL CHECK (kind IN (
                  'google_places',
                  'eventbrite',
                  'tavily',
                  'firecrawl',
                  'manual'
                )),
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled       boolean NOT NULL DEFAULT true,
  schedule_cron text,
  last_run_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scraping_sources_enabled_idx
  ON public.scraping_sources (enabled);

DROP TRIGGER IF EXISTS scraping_sources_set_updated_at ON public.scraping_sources;
CREATE TRIGGER scraping_sources_set_updated_at
  BEFORE UPDATE ON public.scraping_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 2) scraping_runs
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scraping_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid NOT NULL REFERENCES public.scraping_sources(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'running' CHECK (status IN (
                    'running','succeeded','failed','partial'
                  )),
  triggered_by    text,
  items_found     integer NOT NULL DEFAULT 0,
  items_enriched  integer NOT NULL DEFAULT 0,
  items_failed    integer NOT NULL DEFAULT 0,
  error           text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE INDEX IF NOT EXISTS scraping_runs_source_started_idx
  ON public.scraping_runs (source_id, started_at DESC);

CREATE INDEX IF NOT EXISTS scraping_runs_status_idx
  ON public.scraping_runs (status);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) scraped_items_raw  (append-only, idempotente por dedup_hash)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scraped_items_raw (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid NOT NULL REFERENCES public.scraping_runs(id) ON DELETE CASCADE,
  source_id           uuid NOT NULL REFERENCES public.scraping_sources(id) ON DELETE CASCADE,
  source_url          text NOT NULL,
  source_external_id  text,
  raw_payload         jsonb NOT NULL,
  dedup_hash          text NOT NULL,
  scraped_at          timestamptz NOT NULL DEFAULT now()
);

-- Indices: dedup lookup, listing por source en orden cronologico
CREATE UNIQUE INDEX IF NOT EXISTS scraped_items_raw_dedup_idx
  ON public.scraped_items_raw (dedup_hash);

CREATE INDEX IF NOT EXISTS scraped_items_raw_source_scraped_idx
  ON public.scraped_items_raw (source_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS scraped_items_raw_run_idx
  ON public.scraped_items_raw (run_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4) scraped_items_enriched  (normalizado + cola de moderacion)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scraped_items_enriched (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_id                   uuid NOT NULL REFERENCES public.scraped_items_raw(id) ON DELETE CASCADE,
  title                    text NOT NULL,
  description              text,
  category_hint            text,
  location_name            text,
  lat                      double precision,
  lng                      double precision,
  starts_at                timestamptz,
  ends_at                  timestamptz,
  price_cop                integer,
  image_url                text,
  source_url               text,
  quality_score            numeric(3,2),
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN (
                             'pending','approved','rejected','published'
                           )),
  reviewed_by              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at              timestamptz,
  published_place_id       uuid REFERENCES public.places(id) ON DELETE SET NULL,
  published_experience_id  uuid REFERENCES public.experiences(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Indices clave:
--   - moderation queue (status='pending' order by created_at)
--   - feed publico (status='published' order by created_at)
CREATE INDEX IF NOT EXISTS scraped_items_enriched_status_created_idx
  ON public.scraped_items_enriched (status, created_at DESC);

CREATE INDEX IF NOT EXISTS scraped_items_enriched_raw_idx
  ON public.scraped_items_enriched (raw_id);

DROP TRIGGER IF EXISTS scraped_items_enriched_set_updated_at ON public.scraped_items_enriched;
CREATE TRIGGER scraped_items_enriched_set_updated_at
  BEFORE UPDATE ON public.scraped_items_enriched
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.scraping_sources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_items_raw      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_items_enriched ENABLE ROW LEVEL SECURITY;

-- sources/runs/raw: solo service_role (no policies = nadie tiene SELECT).
-- El backend bypassea RLS con service_role, los admins pegan via el backend.

-- enriched: lectura publica del feed (solo published)
DROP POLICY IF EXISTS "enriched_select_published" ON public.scraped_items_enriched;
CREATE POLICY "enriched_select_published"
  ON public.scraped_items_enriched FOR SELECT
  USING (status = 'published');
