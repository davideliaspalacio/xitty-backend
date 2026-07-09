# Deuda de lint backend

Fecha de corte: 2026-07-09.

Comando usado:

```bash
npx eslint "src/**/*.ts"
```

Resultado actual:

- Archivos con problemas: 14.
- Errores: 16.
- Warnings: 0.
- Errores auto-fixables: 14.

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
- PR tecnico #65 `chore/backend-lint-eventbrite-source-spec`:
  `eventbrite-source.ts` y `eventbrite-source.spec.ts` quedan con formato
  Prettier, mock `fetch` tipado, helpers de URL/headers tipados y lint dirigido
  limpio.
- PR tecnico #66 `chore/backend-lint-promotions-controller`:
  `promotions.controller.ts` queda con requests autenticados/opcionales tipados,
  headers seguros para impressions y lint dirigido limpio.
- PR tecnico #67 `chore/backend-lint-places-controller`:
  `places.controller.ts` queda con request autenticado tipado, formato Prettier
  y lint dirigido limpio.
- PR tecnico #68 `chore/backend-lint-auth-controller`:
  `auth.controller.ts` queda con request autenticado tipado, logout sin `async`
  innecesario, formato Prettier y lint dirigido limpio.
- PR tecnico #69 `chore/backend-lint-auth-guard`:
  `auth.guard.ts` queda con payload JWT tipado, request autenticado tipado,
  validacion de `sub`, asignacion de usuario sin `any` y lint dirigido limpio.
- PR tecnico #70 `chore/backend-lint-chat-rate-limit-spec`:
  `chat/rate-limit.service.spec.ts` queda con mock Supabase RPC tipado,
  expectativas formateadas por Prettier y lint dirigido limpio.
- PR tecnico #71 `chore/backend-lint-localize-spec`:
  `localize.spec.ts` queda con fixtures `getLang` tipados, sin casts `any`,
  y lint dirigido limpio.
- PR tecnico #72 `chore/backend-lint-admin-scraping-controller`:
  `admin-scraping.controller.ts` queda con request admin tipado, `assertAdmin`
  como type guard y lint dirigido limpio.
- PR tecnico #73 `chore/backend-lint-notification-settings-controller`:
  `notification-settings.controller.ts` queda con request autenticado tipado,
  rol permitido tipado y lint dirigido limpio.
- PR tecnico #74 `chore/backend-lint-main-bootstrap`:
  `main.ts` queda con callback CORS tipado, bootstrap con `.catch` explicito,
  formato Prettier y lint dirigido limpio.
- PR tecnico #75 `chore/backend-lint-featured-controller`:
  `featured.controller.ts` queda con request autenticado tipado, formato
  Prettier y lint dirigido limpio.
- PR tecnico #76 `chore/backend-lint-local-picks-controller`:
  `local-picks.controller.ts` queda con request autenticado tipado, formato
  Prettier y lint dirigido limpio.
- PR tecnico #77 `chore/backend-lint-reviews-controller`:
  `reviews.controller.ts` queda con request autenticado tipado, formato
  Prettier y lint dirigido limpio.
- PR tecnico #78 `chore/backend-lint-preferences-controller`:
  `preferences.controller.ts` queda con request autenticado tipado y lint
  dirigido limpio.
- PR tecnico #79 `chore/backend-lint-consents-controller`:
  `consents.controller.ts` queda con request autenticado tipado, formato
  Prettier y lint dirigido limpio.
- PR tecnico #80 `chore/backend-lint-location-controller`:
  `location.controller.ts` queda con request autenticado tipado, formato
  Prettier y lint dirigido limpio.
- PR tecnico #81 `chore/backend-lint-scraping-sources-repo`:
  `scraping-sources.repo.ts` queda con resultados Supabase tipados, query
  condicional sin `any`, errores de patch tipados y lint dirigido limpio.
- PR tecnico #82 `chore/backend-lint-experience-list-query-dto`:
  `experience-list-query.dto.ts` queda con transform de tags tipado, import
  sin usar removido, formato Prettier y lint dirigido limpio.
- PR tecnico #83 `chore/backend-lint-supabase-config`:
  `supabase.config.ts` queda con tipo real de `createClient`, formato Prettier
  y lint dirigido limpio.
- PR tecnico #84 `chore/backend-lint-create-experience-dto`:
  `create-experience.dto.ts` queda formateado por Prettier y con lint dirigido
  limpio.
- PR tecnico #85 `chore/backend-lint-create-featured-dto`:
  `create-featured.dto.ts` queda formateado por Prettier y con lint dirigido
  limpio.
- PR tecnico #86 `chore/backend-lint-scraping-runs-repo`:
  `scraping-runs.repo.ts` queda con query condicional tipado, resultado
  Supabase normalizado y lint dirigido limpio.
- PR tecnico #87 `chore/backend-lint-preferences-service`:
  `preferences.service.ts` queda con resultados Supabase tipados, updates sin
  `any` y lint dirigido limpio.
- PR tecnico #88 `chore/backend-lint-source-factory`:
  `source.factory.ts` queda con config normalizada desde `unknown`, type guard
  para Google Places y lint dirigido limpio.
- PR tecnico #89 `chore/backend-lint-mock-chat-provider`:
  `mock-provider.ts` queda sin `async` innecesario, con formato Prettier y lint
  dirigido limpio.
- PR tecnico #90 `chore/backend-lint-favorites-controller`:
  `favorites.controller.ts` queda con request autenticado tipado y lint dirigido
  limpio.
- PR tecnico #91 `chore/backend-lint-enrichment-service`:
  `enrichment.service.ts` y `enrichment.service.spec.ts` quedan con errores
  `unknown`, fake provider sin `async` innecesario y lint dirigido limpio.
- PR tecnico #92 `chore/backend-lint-runner-service`:
  `runner.service.ts` queda con errores `unknown`, helper de mensaje seguro y
  lint dirigido limpio.
- PR tecnico #93 `chore/backend-lint-source-factory-spec`:
  `source.factory.spec.ts` queda con fixture tipada, sin casts `any`, formato
  Prettier y lint dirigido limpio.
- PR tecnico #94 `chore/backend-lint-scraping-module-spec`:
  `scraping.module.spec.ts` queda formateado por Prettier y con lint dirigido
  limpio.
- PR tecnico #95 `chore/backend-lint-localize`:
  `localize.ts` queda con records `unknown`, header validado y lint dirigido
  limpio.
- PR tecnico #96 `chore/backend-lint-chat-response-dto`:
  `message-response.dto.ts` queda formateado por Prettier y con lint dirigido
  limpio.
- PR tecnico #97 `chore/backend-lint-reservation-response-dto`:
  `reservation-response.dto.ts` queda formateado por Prettier y con lint
  dirigido limpio.
- PR tecnico #98 `chore/backend-lint-microsites-service`:
  `microsites.service.ts` queda con resultado Supabase tipado, sin casts `any`,
  y lint dirigido limpio.
- PR tecnico #99 `chore/backend-lint-place-list-query-dto`:
  `place-list-query.dto.ts` queda formateado por Prettier y con lint dirigido
  limpio.
- PR tecnico #100 `chore/backend-lint-recommendation-item-dto`:
  `recommendation-item.dto.ts` queda formateado por Prettier y con lint
  dirigido limpio.
- PR tecnico #101 `chore/backend-lint-recommendations-controller`:
  `recommendations.controller.ts` queda con request autenticado tipado, formato
  Prettier y lint dirigido limpio.
- PR tecnico #102 `chore/backend-lint-quality-scorer-spec`:
  `quality-scorer.spec.ts` queda formateado por Prettier y con lint dirigido
  limpio.
- PR tecnico #103 `chore/backend-lint-openai-chat-provider`:
  `openai-provider.ts` queda con errores `unknown`, helper de mensaje seguro,
  formato Prettier y lint dirigido limpio.
- PR tecnico #104 `chore/backend-lint-chat-rate-limit-service`:
  `rate-limit.service.ts` queda con resultado RPC tipado, formato Prettier y
  lint dirigido limpio.
- PR tecnico #105 `chore/backend-lint-create-slot-dto`:
  `create-slot.dto.ts` queda formateado por Prettier y con lint dirigido limpio.
- PR tecnico #106 `chore/backend-lint-create-local-pick-dto`:
  `create-local-pick.dto.ts` queda formateado por Prettier y con lint dirigido
  limpio.
- PR tecnico #107 `chore/backend-lint-mock-enrichment-provider`:
  `mock-enrichment-provider.ts` queda sin `async` innecesario, sin parametro
  sin usar y con lint dirigido limpio.
- PR tecnico #108 `chore/backend-lint-openai-enrichment-provider`:
  `openai-enrichment-provider.ts` queda con errores `unknown`, helper de
  mensaje seguro, formato Prettier y lint dirigido limpio.
- PR tecnico #109 `chore/backend-lint-quality-scorer-service`:
  `quality-scorer.service.ts` queda formateado por Prettier y con lint dirigido
  limpio.
- PR tecnico pendiente `chore/backend-lint-discover-controller`:
  `discover.controller.ts` queda formateado por Prettier y con lint dirigido
  limpio.
- Reduccion neta acumulada: -104 archivos con problemas, -2694 errores y -247 warnings.

## Reglas principales

| Regla | Errores | Warnings | Lectura |
| --- | ---: | ---: | --- |
| `prettier/prettier` | 14 | 0 | Formato historico fuera de Prettier. |
| `@typescript-eslint/require-await` | 2 | 0 | Funciones async sin await. |

## Archivos mas afectados

| Archivo | Errores | Warnings |
| --- | ---: | ---: |
| `src/modules/scraping/public/dto/curated-item.dto.ts` | 2 | 0 |
| `src/modules/scraping/scheduler/scheduler.module.ts` | 2 | 0 |
| `src/config/database.module.ts` | 1 | 0 |
| `src/modules/auth/dto/refresh-token.dto.ts` | 1 | 0 |

## Impacto en Features v2

- Los PRs nuevos corrieron lint dirigido sobre archivos tocados cuando aplicaba.
- La suite completa backend y build estan verdes.
- El full lint backend no es aun una gate confiable de release porque falla por deuda previa amplia.

## Plan recomendado

1. PR tecnico solo de Prettier: correr formato controlado y revisar diff mecanico.
2. PR de helpers tipados para mocks Supabase de tests.
3. Migrar specs grandes por modulo: scraping, promociones, ranking, metricas.
4. Endurecer gradualmente `no-unsafe-*` por carpeta cuando cada modulo quede limpio.
