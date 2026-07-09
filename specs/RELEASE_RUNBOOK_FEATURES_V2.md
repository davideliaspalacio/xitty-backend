# Runbook de release - Features v2

Este runbook ordena los PRs, migraciones y checks operativos para subir el paquete Features v2 sin mezclar pasos.

Checklist de cutover produccion: `specs/FEATURES_V2_PRODUCTION_CUTOVER.md`.

Estado actual: los PRs backend #22-#126 y frontend #18-#26 ya fueron mergeados en `main` el 2026-07-09. F6 tiene un cierre extra en rama `feat/f6-reservation-outbox` para avisos de reservas confirmadas.

Verificacion post-merge local:

- Backend `main`: `npm test -- --runInBand` OK (38 suites / 477 tests), `npm run build` OK, `npx eslint "src/**/*.ts"` OK.
- Frontend `main`: `npm run test:run` OK (44 files / 215 tests), `npm run typecheck` OK, `npm run lint` OK, `npm run build` OK.
- Migraciones locales: `supabase db reset` OK en copia temporal, aplicando todas las migraciones hasta `20260709000013_harden_backend_service_role_and_place_rpc.sql`.
- Smoke con backend apuntando a DB local migrada: `/categories`, `/places?city=Cartagena`, `/places?sort_by=distance&city=Cartagena` y `/ranking?city=Cartagena` respondieron 200.
- Frontend envia `city` al ranking, listado y busqueda usando `NEXT_PUBLIC_DEFAULT_CITY`, para consumir rankings/listados por ciudad.

## Orden de merge completado

### Backend

1. #22 - F4 tracking anti-inflado, base `main`.
2. #23 - F5 metricas comparativas, base #22.
3. #24 - F2 slugs/microsites publicos, base #23.
4. #25 - F3 promociones con timezone y visibilidad publica, base #24.
5. #26 - F7 ranking inteligente, base #25.
6. #27 - F8 patrocinios, base #26.
7. #28 - F9 destacados semanales, base #27.
8. #29 - F6 notification outbox, base #28.
9. #30 - F1 proveniencia y reporte de completitud, base #29.
10. #31 - F1 fuentes Cartagena ampliadas, base #30.
11. #32 - F7 rankings por ciudad/zona, base #31.
12. #33 - PR tecnico Google Places lint/typing, base #32.
13. #34 - PR tecnico scraped-items repo spec lint/typing, base #33.
14. #35 - PR tecnico scraping storage specs lint/typing, base #34.
15. #36 - PR tecnico scraping executor spec lint/typing, base #35.
16. #37 - PR tecnico scraping admin spec lint/typing, base #36.
17. #38 - PR tecnico scraping runner spec lint/typing, base #37.
18. #39 - PR tecnico dedup enrichment lint/typing, base #38.
19. #40 - PR tecnico discover public lint/typing, base #39.
20. #41 - PR tecnico promotions service/spec lint/typing, base #40.
21. #42 - PR tecnico chat service/spec lint/typing, base #41.
22. #43 - PR tecnico reservations service/spec lint/typing, base #42.
23. #44 - PR tecnico experiences service/spec lint/typing, base #43.
24. #45 - PR tecnico ranking spec lint/typing, base #44.
25. #46 - PR tecnico places service/spec lint/typing, base #45.
26. #47 - PR tecnico metrics spec lint/typing, base #46.
27. #48 - PR tecnico recommendations service/spec lint/typing, base #47.
28. #49 - PR tecnico experience reviews service/spec lint/typing, base #48.
29. #50 - PR tecnico favorites service/spec lint/typing, base #49.
30. #51 - PR tecnico local picks service/spec lint/typing, base #50.
31. #52 - PR tecnico featured service/spec lint/typing, base #51.
32. #53 - PR tecnico reviews service/spec lint/typing, base #52.
33. #54 - PR tecnico consents service/spec lint/typing, base #53.
34. #55 - PR tecnico experiences controller lint/typing, base #54.
35. #56 - PR tecnico chat RAG context service/spec lint/typing, base #55.
36. #57 - PR tecnico location service/spec lint/typing, base #56.
37. #58 - PR tecnico chat controller/spec lint/typing, base #57.
38. #59 - PR tecnico suggestions service/spec lint/typing, base #58.
39. #60 - PR tecnico notification settings service/spec lint/typing, base #59.
40. #61 - PR tecnico Tavily search source/spec lint/typing, base #60.
41. #62 - PR tecnico auth service lint/typing, base #61.
42. #63 - PR tecnico photo storage service/spec lint/typing, base #62.
43. #64 - PR tecnico metrics controller lint/typing, base #63.
44. #65 - PR tecnico Eventbrite source/spec lint/typing, base #64.
45. #66 - PR tecnico promotions controller lint/typing, base #65.
46. #67 - PR tecnico places controller lint/typing, base #66.
47. #68 - PR tecnico auth controller lint/typing, base #67.
48. #69 - PR tecnico auth guard lint/typing, base #68.
49. #70 - PR tecnico chat rate limit spec lint/typing, base #69.
50. #71 - PR tecnico localize spec lint/typing, base #70.
51. #72 - PR tecnico admin scraping controller lint/typing, base #71.
52. #73 - PR tecnico notification settings controller lint/typing, base #72.
53. #74 - PR tecnico main bootstrap lint/typing, base #73.
54. #75 - PR tecnico featured controller lint/typing, base #74.
55. #76 - PR tecnico local picks controller lint/typing, base #75.
56. #77 - PR tecnico reviews controller lint/typing, base #76.
57. #78 - PR tecnico preferences controller lint/typing, base #77.
58. #79 - PR tecnico consents controller lint/typing, base #78.
59. #80 - PR tecnico location controller lint/typing, base #79.
60. #81 - PR tecnico scraping sources repo lint/typing, base #80.
61. #82 - PR tecnico experience list query dto lint/typing, base #81.
62. #83 - PR tecnico supabase config lint/typing, base #82.
63. #84 - PR tecnico create experience dto lint/typing, base #83.
64. #85 - PR tecnico create featured dto lint/typing, base #84.
65. #86 - PR tecnico scraping runs repo lint/typing, base #85.
66. #87 - PR tecnico preferences service lint/typing, base #86.
67. #88 - PR tecnico source factory lint/typing, base #87.
68. #89 - PR tecnico mock chat provider lint/typing, base #88.
69. #90 - PR tecnico favorites controller lint/typing, base #89.
70. #91 - PR tecnico enrichment service lint/typing, base #90.
71. #92 - PR tecnico runner service lint/typing, base #91.
72. #93 - PR tecnico source factory spec lint/typing, base #92.
73. #94 - PR tecnico scraping module spec lint/typing, base #93.
74. #95 - PR tecnico localize lint/typing, base #94.
75. #96 - PR tecnico chat response dto lint/typing, base #95.
76. #97 - PR tecnico reservation response dto lint/typing, base #96.
77. #98 - PR tecnico microsites service lint/typing, base #97.
78. #99 - PR tecnico place list query dto lint/typing, base #98.
79. #100 - PR tecnico recommendation item dto lint/typing, base #99.
80. #101 - PR tecnico recommendations controller lint/typing, base #100.
81. #102 - PR tecnico quality scorer spec lint/typing, base #101.
82. #103 - PR tecnico openai chat provider lint/typing, base #102.
83. #104 - PR tecnico chat rate limit service lint/typing, base #103.
84. #105 - PR tecnico create slot dto lint/typing, base #104.
85. #106 - PR tecnico create local pick dto lint/typing, base #105.
86. #107 - PR tecnico mock enrichment provider lint/typing, base #106.
87. #108 - PR tecnico openai enrichment provider lint/typing, base #107.
88. #109 - PR tecnico quality scorer service lint/typing, base #108.
89. #110 - PR tecnico discover controller lint/typing, base #109.
90. #111 - PR tecnico curated item dto lint/typing, base #110.
91. #112 - PR tecnico scheduler module lint/typing, base #111.
92. #113 - PR tecnico database module lint/typing, base #112.
93. #114 - PR tecnico refresh token dto lint/typing, base #113.
94. #115 - PR tecnico create conversation dto lint/typing, base #114.
95. #116 - PR tecnico create experience review dto lint/typing, base #115.
96. #117 - PR tecnico experience review response dto lint/typing, base #116.
97. #118 - PR tecnico experiences module lint/typing, base #117.
98. #119 - PR tecnico favorite response dto lint/typing, base #118.
99. #120 - PR tecnico category response dto lint/typing, base #119.
100. #121 - PR tecnico create place photo dto lint/typing, base #120.
101. #122 - PR tecnico OG response dto lint/typing, base #121.
102. #123 - PR tecnico promotion response dto lint/typing, base #122.
103. #124 - PR tecnico scraper source interface lint/typing, base #123.

### Frontend

1. #18 - F4 tracking anonimo, base `main`.
2. #19 - F5 dashboard de metricas, base #18.
3. #20 - F2 URL corta de microsites, base #19.
4. #21 - F3 gestion de promociones, base #20.
5. #22 - F7 movimiento semanal de ranking, base #21.
6. #23 - F8 gestion/visual de patrocinios, base #22.
7. #24 - F6 copy de notificaciones y tokens verdes, base #23.
8. `fdd97ad` - ciudad operativa por defecto para discovery.
9. `<post-merge>` - UI admin de destacados semanales en `/admin/featured`.
10. Backend #125 / Frontend #25 - reporte admin F1 de calidad/completitud en `/admin/scraping`.
11. Backend #126 / Frontend #26 - configuracion admin del ranking en `/admin/ranking`.

## Migraciones backend nuevas

Aplicar en orden cronologico despues de mergear cada PR backend correspondiente:

1. `20260709000001_harden_microsite_interactions.sql`
2. `20260709000002_improve_metrics_summary_timeseries.sql`
3. `20260709000003_harden_place_slugs.sql`
4. `20260709000004_harden_promotions_public_visibility.sql`
5. `20260709000005_improve_place_rankings.sql`
6. `20260709000006_harden_sponsored_placements.sql`
7. `20260709000007_harden_featured_content.sql`
8. `20260709000008_create_notification_outbox.sql`
9. `20260709000009_place_source_provenance_report.sql`
10. `20260709000010_expand_cartagena_scraping_sources.sql`
11. `20260709000011_city_scoped_rankings.sql`
12. `20260709000012_filter_nearby_places_by_city_zone.sql`
13. `20260709000013_harden_backend_service_role_and_place_rpc.sql`
14. `20260709000014_extend_place_data_completeness_report.sql`
15. `20260709000015_add_reservation_created_notifications.sql`

La configuracion admin del ranking no agrega migracion nueva: reutiliza `ranking_config` de `20260709000005_improve_place_rankings.sql`.

Despues de aplicar todas las migraciones, correr:

```sql
SELECT public.refresh_place_rankings();
```

## Variables de entorno

Backend runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `GOOGLE_MAPS_API_KEY` para que el scraper use Google Places real. Si falta, el scraper cae a mock data.
- `OPENAI_API_KEY` opcional para enrichment/chat real. Si falta, se usan respuestas mock donde aplica.

Frontend runtime:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_DEFAULT_CITY` para definir la ciudad operativa del home, ranking y listados; default recomendado actual: `Barranquilla`.
- Feature flags: por defecto quedan encendidas; usar `NEXT_PUBLIC_DISABLED_FEATURES` y `NEXT_PUBLIC_DISABLED_LANDING_SECTIONS` solo para apagar algo puntual.

## Estado de acceso a produccion

Desde esta maquina no se pudieron aplicar migraciones remotas porque el CLI no tiene proyecto enlazado ni token de plataforma:

- `supabase projects list` falla por falta de `SUPABASE_ACCESS_TOKEN`/`supabase login`.
- `supabase migration list` falla porque no hay project ref enlazado.
- La `.env` local del backend tiene variables runtime de Supabase, pero eso no reemplaza el acceso de plataforma necesario para aplicar DDL remoto con el CLI.

Para quien tenga acceso al proyecto Supabase correcto:

1. Ejecutar `supabase login` o exportar `SUPABASE_ACCESS_TOKEN`.
2. Ejecutar `supabase link --project-ref <project-ref-produccion>`.
3. Ejecutar `supabase db push` desde `xitty-backend`.
4. Confirmar que se aplicaron las 15 migraciones `20260709...`.
5. Correr en SQL editor: `SELECT public.refresh_place_rankings();`.

## Post-merge operativo

Checklist ejecutable para produccion/staging: `specs/FEATURES_V2_PRODUCTION_CUTOVER.md`.
Smoke automatizado: `npm run smoke:features-v2 -- --api-url "$API_URL" --city Cartagena`.

1. Confirmar que backend y frontend despliegan contra la misma rama/base ya mergeada.
2. Aplicar migraciones en orden y verificar que no quedan migraciones pendientes.
3. Confirmar `GOOGLE_MAPS_API_KEY` en el backend antes de ejecutar fuentes reales.
4. Entrar como admin a `/admin/scraping` y ejecutar fuentes Cartagena de forma gradual.
5. Revisar items enriquecidos antes de publicar; no publicar fotos masivamente hasta tener politica/licencia aprobada.
6. Publicar una muestra controlada y revisar `/admin/scraping` > "Calidad de datos"; si hace falta, consultar `place_data_completeness` por SQL.
7. Correr `SELECT public.refresh_place_rankings();` despues de publicar lugares relevantes.
8. Entrar como admin a `/admin/ranking`, revisar pesos/caps/ventana y ejecutar refresh manual si hace falta.
9. Validar rankings por ciudad: `/ranking?city=Cartagena`.
10. Validar perfiles publicos, promociones, tracking, metricas, patrocinios y destacados con datos reales.

## Checks de QA

- Landing publica carga con secciones activadas y marca verde.
- Perfil publico por slug muestra CTA reales y Open Graph basico.
- Promociones activas respetan fechas Colombia.
- Tracking anonimo no rompe UX y deduplica doble click.
- Dashboard del dueno muestra dias sin eventos en cero.
- Notificaciones respetan preferencias y escriben en outbox/pending.
- Reservas confirmadas escriben `reservation_created` en outbox cuando `notify_reservation_click` esta activo.
- Ranking general y por categoria no muestra lugares desactivados.
- Admin puede ajustar pesos/caps/ventana y refrescar ranking en `/admin/ranking`.
- Patrocinados siempre muestran sello "Patrocinado".
- Destacados semanales tienen fallback si no hay programacion.
- Admin puede programar, pausar y eliminar destacados en `/admin/featured`.
- Admin puede ver resumen, desglose por categoria y faltantes por lugar en `/admin/scraping` > "Calidad de datos".

## Pendientes explicitamente no cerrados

- Definir politica legal/fuente de fotos antes de subir fotos masivamente.
- Definir proveedor/canal real para notificaciones externas.
- Cargar mas audiotours fuera del piloto inicial.
- Crear datos reales de promociones con negocios o marcarlas claramente como demo.
- Completar QA mobile/desktop contra datos reales de produccion.
