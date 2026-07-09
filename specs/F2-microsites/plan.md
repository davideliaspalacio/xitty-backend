# Plan tecnico - F2 microsites

## Checklist

- [x] Crear migracion que refuerce `places_set_slug` con slugs reservados y fallback `lugar`.
- [x] Agregar ruta frontend corta `src/app/[slug]/page.tsx`.
- [x] Cambiar metadata/share/footer para apuntar a `/:slug`.
- [x] Ejecutar build/typecheck enfocados.

## Migracion

Archivo: `supabase/migrations/20260709000003_harden_place_slugs.sql`.

No elimina datos. Reemplaza funcion trigger de slug y repara filas con slugs reservados/vacios.
