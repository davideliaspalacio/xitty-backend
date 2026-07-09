# Deuda de lint backend

Fecha de corte: 2026-07-09.

Comando usado:

```bash
npx eslint "src/**/*.ts"
```

Resultado actual:

- Archivos con problemas: 62.
- Errores: 251.
- Warnings: 66.
- Errores auto-fixables: 127.

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
- PR tecnico #51 `chore/backend-lint-local-picks-service-spec`:
  `local-picks.service.ts` y `local-picks.service.spec.ts` quedan con filas de
  picks/lugares/fotos tipadas, updates parciales sin `any`, mocks Supabase
  tipados y lint dirigido limpio.
- PR tecnico #52 `chore/backend-lint-featured-service-spec`:
  `featured.service.ts` y `featured.service.spec.ts` quedan con filas de
  destacados/lugares/fotos tipadas, fallback semanal tipado, updates parciales
  sin `any`, mocks Supabase tipados y lint dirigido limpio.
- PR tecnico #53 `chore/backend-lint-reviews-service-spec`:
  `reviews.service.ts` y `reviews.service.spec.ts` quedan con filas de resenas
  tipadas, updates parciales sin `any`, mocks Supabase tipados y lint dirigido
  limpio. `create-review.dto.ts` queda formateado por Prettier.
- PR tecnico #54 `chore/backend-lint-consents-service-spec`:
  `consents.service.ts` y `consents.service.spec.ts` quedan con resultados de
  consentimiento tipados, mocks Supabase/upsert tipados y lint dirigido limpio.
- PR tecnico #55 `chore/backend-lint-experiences-controller`:
  `experiences.controller.ts` queda con requests autenticados tipados, imports
  limpios, formato Prettier y lint dirigido limpio.
- PR tecnico #56 `chore/backend-lint-chat-rag-context`:
  `chat/rag/context.service.ts` y `chat/rag/context.service.spec.ts` quedan con
  filas de categorias/lugares tipadas, errores `unknown`, mocks Supabase tipados
  y lint dirigido limpio.
- PR tecnico #57 `chore/backend-lint-location-service-spec`:
  `location.service.ts` y `location.service.spec.ts` quedan con formato Prettier,
  mocks Supabase tipados y lint dirigido limpio.
- PR tecnico #58 `chore/backend-lint-chat-controller-spec`:
  `chat.controller.ts` y `chat.controller.spec.ts` quedan con request
  autenticado tipado, mocks del controller tipados, respuestas Supertest
  tipadas y lint dirigido limpio.
- PR tecnico #59 `chore/backend-lint-suggestions-service-spec`:
  `suggestions.service.ts` y `suggestions.service.spec.ts` quedan con payload
  RPC tratado como `unknown`, normalizadores tipados, mock Supabase RPC tipado
  y lint dirigido limpio.
- PR tecnico #60 `chore/backend-lint-notification-settings-service-spec`:
  `notification-settings.service.ts` y `notification-settings.service.spec.ts`
  quedan con resultados Supabase tipados, updates sin `any`, mock chain
  Supabase tipado y lint dirigido limpio.
- PR tecnico #61 `chore/backend-lint-tavily-search-source-spec`:
  `tavily-search-source.ts` y `tavily-search-source.spec.ts` quedan con
  errores `unknown`, helper de mensaje seguro, mock `fetch` tipado, body
  Tavily tipado y lint dirigido limpio.
- PR tecnico #62 `chore/backend-lint-auth-service`:
  `auth.service.ts` queda con perfiles/usuarios paginados/resultados Supabase
  tipados, updates sin `any`, retornos publicos exportados y lint dirigido
  limpio.
- PR tecnico #63 `chore/backend-lint-photo-storage-service-spec`:
  `photo-storage.service.ts` y `photo-storage.service.spec.ts` quedan con
  `fetch` inyectado en tests sin `any`, mock Supabase Storage tipado, errores
  `unknown` y lint dirigido limpio.
- PR tecnico #64 `chore/backend-lint-metrics-controller`:
  `metrics.controller.ts` queda con requests/headers/JWT payload tipados,
  extraccion opcional de auth sin `any` y lint dirigido limpio.
- Reduccion neta acumulada: -56 archivos con problemas, -2459 errores y -181 warnings.

## Reglas principales

| Regla | Errores | Warnings | Lectura |
| --- | ---: | ---: | --- |
| `prettier/prettier` | 127 | 0 | Formato historico fuera de Prettier. |
| `@typescript-eslint/no-unsafe-member-access` | 78 | 0 | Acceso a datos `any`, sobre todo mocks Supabase/tests. |
| `@typescript-eslint/no-unsafe-argument` | 0 | 65 | Argumentos `any` en tests/servicios. |
| `@typescript-eslint/no-unsafe-assignment` | 21 | 0 | Asignaciones desde `any`. |
| `@typescript-eslint/no-unsafe-call` | 8 | 0 | Llamadas sobre valores `any`. |
| `@typescript-eslint/require-await` | 6 | 0 | Funciones async sin await. |
| `@typescript-eslint/no-unsafe-return` | 4 | 0 | Retornos `any` sin tipar. |
| `@typescript-eslint/no-base-to-string` | 3 | 0 | Conversion implicita a string. |
| `@typescript-eslint/no-unused-vars` | 2 | 0 | Variables/imports historicos sin usar. |

## Archivos mas afectados

| Archivo | Errores | Warnings |
| --- | ---: | ---: |
| `src/modules/scraping/sources/eventbrite-source.spec.ts` | 20 | 1 |
| `src/modules/promotions/promotions.controller.ts` | 11 | 9 |
| `src/modules/places/places.controller.ts` | 10 | 7 |
| `src/modules/auth/auth.controller.ts` | 10 | 3 |
| `src/common/guards/auth.guard.ts` | 11 | 0 |
| `src/common/i18n/__tests__/localize.spec.ts` | 0 | 11 |
| `src/modules/chat/rate-limit.service.spec.ts` | 11 | 0 |
| `src/modules/scraping/admin/admin-scraping.controller.ts` | 8 | 3 |

## Impacto en Features v2

- Los PRs nuevos corrieron lint dirigido sobre archivos tocados cuando aplicaba.
- La suite completa backend y build estan verdes.
- El full lint backend no es aun una gate confiable de release porque falla por deuda previa amplia.

## Plan recomendado

1. PR tecnico solo de Prettier: correr formato controlado y revisar diff mecanico.
2. PR de helpers tipados para mocks Supabase de tests.
3. Migrar specs grandes por modulo: scraping, promociones, ranking, metricas.
4. Endurecer gradualmente `no-unsafe-*` por carpeta cuando cada modulo quede limpio.
