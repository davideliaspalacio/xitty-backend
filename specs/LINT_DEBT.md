# Deuda de lint backend

Fecha de corte: 2026-07-09.

Comando usado:

```bash
npx eslint "src/**/*.ts"
```

Resultado actual:

- Archivos con problemas: 88.
- Errores: 867.
- Warnings: 135.
- Errores auto-fixables: 235.

Avance aplicado:

- PR tecnico #33 `chore/backend-lint-google-places`: `google-places-source.ts`
  y `google-places-source.spec.ts` quedaron con lint dirigido limpio.
- PR tecnico #34 `chore/backend-lint-scraped-items-spec`:
  `scraped-items.repo.spec.ts` queda con lint dirigido limpio.
- PR tecnico #35 `chore/backend-lint-scraping-storage-specs`:
  `scraping-runs.repo.spec.ts` y `scraping-sources.repo.spec.ts` quedan con
  lint dirigido limpio.
- PR tecnico #36 `chore/backend-lint-scraping-executor-spec`:
  `scraping-executor.service.spec.ts` queda con mocks tipados y lint dirigido
  limpio.
- PR tecnico #37 `chore/backend-lint-scraping-admin-spec`:
  `admin-scraping.service.spec.ts` queda con mocks Supabase/repos tipados y lint
  dirigido limpio.
- PR tecnico #38 `chore/backend-lint-scraping-runner-spec`:
  `runner.service.spec.ts` queda con mocks del runner tipados y lint dirigido
  limpio.
- PR tecnico #39 `chore/backend-lint-dedup-spec`:
  `dedup.service.ts` y `dedup.service.spec.ts` quedan con contrato de duplicado
  tipado, mocks Supabase tipados y lint dirigido limpio.
- PR tecnico #40 `chore/backend-lint-discover-spec`:
  `discover.service.ts` y `discover.service.spec.ts` quedan con filas publicas
  tipadas, mocks Supabase tipados y lint dirigido limpio.
- PR tecnico #41 `chore/backend-lint-promotions-spec`:
  `promotions.service.ts` y `promotions.service.spec.ts` quedan con contratos
  publicos de promociones tipados, mocks Supabase tipados y lint dirigido limpio.
- PR tecnico #42 `chore/backend-lint-chat-spec`:
  `chat.service.ts` y `chat.service.spec.ts` quedan con contratos Supabase
  tipados, mocks de chat/RAG/rate-limit tipados y lint dirigido limpio.
- PR tecnico #43 `chore/backend-lint-reservations-spec`:
  `reservations.service.ts` y `reservations.service.spec.ts` quedan con filas
  de reservas/slots/fotos tipadas, mocks Supabase tipados y lint dirigido limpio.
- PR tecnico #44 `chore/backend-lint-experiences-service-spec`:
  `experiences.service.ts` y `experiences.service.spec.ts` quedan con filas
  de catalogo/detalle/slots tipadas, mocks Supabase tipados y lint dirigido limpio.
- PR tecnico #45 `chore/backend-lint-ranking-spec`:
  `ranking.service.spec.ts` queda con mocks Supabase/RPC tipados y lint dirigido
  limpio.
- PR tecnico #46 `chore/backend-lint-places-spec`:
  `places.service.ts` y `places.service.spec.ts` quedan con filas de
  categorias/lugares/fotos tipadas, mocks Supabase tipados y lint dirigido
  limpio.
- PR tecnico #47 `chore/backend-lint-metrics-spec`:
  `metrics.service.spec.ts` queda con mocks Supabase/RPC tipados y lint dirigido
  limpio.
- PR tecnico #48 `chore/backend-lint-recommendations-service-spec`:
  `recommendations.service.ts` y `recommendations.service.spec.ts` quedan con
  filas de recomendacion/lugares tipadas, mocks Supabase/RPC tipados y lint
  dirigido limpio.
- PR tecnico #49 `chore/backend-lint-experience-reviews-service-spec`:
  `experience-reviews.service.ts` y `experience-reviews.service.spec.ts` quedan
  con filas de reviews/fotos/distribucion tipadas, mocks Supabase/RPC tipados y
  lint dirigido limpio.
- PR tecnico #50 `chore/backend-lint-favorites-service-spec`:
  `favorites.service.ts` y `favorites.service.spec.ts` quedan con filas de
  favoritos/lugares/covers tipadas, mocks Supabase tipados y lint dirigido
  limpio.
- Reduccion neta acumulada: -30 archivos con problemas, -1843 errores y -112 warnings.

## Reglas principales

| Regla | Errores | Warnings | Lectura |
| --- | ---: | ---: | --- |
| `@typescript-eslint/no-unsafe-member-access` | 327 | 0 | Acceso a datos `any`, sobre todo mocks Supabase/tests. |
| `prettier/prettier` | 234 | 0 | Formato historico fuera de Prettier. |
| `@typescript-eslint/no-unsafe-assignment` | 143 | 0 | Asignaciones desde `any`. |
| `@typescript-eslint/no-unsafe-argument` | 0 | 134 | Argumentos `any` en tests/servicios. |
| `@typescript-eslint/no-unsafe-call` | 81 | 0 | Llamadas sobre valores `any`. |
| `@typescript-eslint/no-unsafe-return` | 58 | 0 | Retornos `any` sin tipar. |
| `@typescript-eslint/require-await` | 9 | 0 | Funciones async sin await. |
| `@typescript-eslint/no-unused-vars` | 5 | 0 | Variables/imports historicos sin usar. |
| `@typescript-eslint/unbound-method` | 4 | 0 | Metodos usados sin bind, principalmente mocks. |
| `@typescript-eslint/no-base-to-string` | 3 | 0 | Conversion implicita a string. |

## Archivos mas afectados

| Archivo | Errores | Warnings |
| --- | ---: | ---: |
| `src/modules/local-picks/local-picks.service.spec.ts` | 54 | 2 |
| `src/modules/featured/featured.service.spec.ts` | 53 | 2 |
| `src/modules/experiences/experiences.controller.ts` | 26 | 19 |
| `src/modules/reviews/reviews.service.spec.ts` | 46 | 2 |
| `src/modules/consents/consents.service.spec.ts` | 43 | 3 |
| `src/modules/featured/featured.service.ts` | 42 | 0 |
| `src/modules/chat/rag/context.service.spec.ts` | 39 | 2 |
| `src/modules/local-picks/local-picks.service.ts` | 39 | 0 |
| `src/modules/location/location.service.spec.ts` | 36 | 2 |
| `src/modules/chat/chat.controller.spec.ts` | 17 | 14 |
| `src/modules/suggestions/suggestions.service.spec.ts` | 28 | 2 |
| `src/modules/chat/rag/context.service.ts` | 29 | 0 |
| `src/modules/notification-settings/notification-settings.service.spec.ts` | 24 | 2 |
| `src/modules/scraping/sources/tavily-search-source.spec.ts` | 26 | 0 |
| `src/modules/auth/auth.service.ts` | 23 | 2 |

## Impacto en Features v2

- Los PRs nuevos corrieron lint dirigido sobre archivos tocados cuando aplicaba.
- La suite completa backend y build estan verdes.
- El full lint backend no es aun una gate confiable de release porque falla por deuda previa amplia.

## Plan recomendado

1. PR tecnico solo de Prettier: correr formato controlado y revisar diff mecanico.
2. PR de helpers tipados para mocks Supabase de tests.
3. Migrar specs grandes por modulo: scraping, promociones, ranking, metricas.
4. Endurecer gradualmente `no-unsafe-*` por carpeta cuando cada modulo quede limpio.
