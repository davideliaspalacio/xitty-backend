# Deuda de lint backend

Fecha de corte: 2026-07-09.

Comando usado:

```bash
npx eslint "src/**/*.ts"
```

Resultado actual:

- Archivos con problemas: 113.
- Errores: 2348.
- Warnings: 237.
- Errores auto-fixables: 524.

Avance aplicado:

- PR tecnico #33 `chore/backend-lint-google-places`: `google-places-source.ts`
  y `google-places-source.spec.ts` quedaron con lint dirigido limpio.
- PR tecnico #34 `chore/backend-lint-scraped-items-spec`:
  `scraped-items.repo.spec.ts` queda con lint dirigido limpio.
- PR tecnico #35 `chore/backend-lint-scraping-storage-specs`:
  `scraping-runs.repo.spec.ts` y `scraping-sources.repo.spec.ts` quedan con
  lint dirigido limpio.
- Reduccion neta acumulada: -5 archivos con problemas, -362 errores y -10 warnings.

## Reglas principales

| Regla | Errores | Warnings | Lectura |
| --- | ---: | ---: | --- |
| `@typescript-eslint/no-unsafe-member-access` | 856 | 0 | Acceso a datos `any`, sobre todo mocks Supabase/tests. |
| `prettier/prettier` | 523 | 0 | Formato historico fuera de Prettier. |
| `@typescript-eslint/no-unsafe-assignment` | 378 | 0 | Asignaciones desde `any`. |
| `@typescript-eslint/no-unsafe-call` | 359 | 0 | Llamadas sobre valores `any`. |
| `@typescript-eslint/no-unsafe-argument` | 0 | 236 | Argumentos `any` en tests/servicios. |
| `@typescript-eslint/no-unsafe-return` | 149 | 0 | Retornos `any` sin tipar. |
| `@typescript-eslint/unbound-method` | 52 | 0 | Metodos usados sin bind, principalmente mocks. |
| `@typescript-eslint/require-await` | 18 | 0 | Funciones async sin await. |

## Archivos mas afectados

| Archivo | Errores | Warnings |
| --- | ---: | ---: |
| `src/modules/scraping/admin/admin-scraping.service.spec.ts` | 95 | 34 |
| `src/modules/promotions/promotions.service.spec.ts` | 114 | 2 |
| `src/modules/chat/chat.service.spec.ts` | 111 | 2 |
| `src/modules/experiences/reservations.service.spec.ts` | 96 | 2 |
| `src/modules/experiences/experiences.service.spec.ts` | 94 | 3 |
| `src/modules/ranking/ranking.service.spec.ts` | 95 | 2 |
| `src/modules/places/places.service.spec.ts` | 92 | 2 |
| `src/modules/metrics/metrics.service.spec.ts` | 90 | 2 |
| `src/modules/scraping/public/discover.service.spec.ts` | 82 | 3 |
| `src/modules/recommendations/recommendations.service.spec.ts` | 75 | 2 |
| `src/modules/experiences/experience-reviews.service.spec.ts` | 68 | 6 |
| `src/modules/favorites/favorites.service.spec.ts` | 58 | 2 |
| `src/modules/scraping/executor/scraping-executor.service.spec.ts` | 30 | 28 |
| `src/modules/local-picks/local-picks.service.spec.ts` | 54 | 2 |
| `src/modules/experiences/experiences.service.ts` | 55 | 0 |

## Impacto en Features v2

- Los PRs nuevos corrieron lint dirigido sobre archivos tocados cuando aplicaba.
- La suite completa backend y build estan verdes.
- El full lint backend no es aun una gate confiable de release porque falla por deuda previa amplia.

## Plan recomendado

1. PR tecnico solo de Prettier: correr formato controlado y revisar diff mecanico.
2. PR de helpers tipados para mocks Supabase de tests.
3. Migrar specs grandes por modulo: scraping, promociones, ranking, metricas.
4. Endurecer gradualmente `no-unsafe-*` por carpeta cuando cada modulo quede limpio.
