# F2 - Perfil publico con URL propia

## Objetivo

Hacer que cada negocio/lugar tenga una URL corta y compartible tipo `xitty.co/la-trattoria-anna`, con metadata social correcta y slugs seguros.

## Criterios

- La ruta corta `/:slug` resuelve el mismo microsite existente.
- Las rutas propias de la app (`/login`, `/admin`, `/places`, etc.) no pueden ser usadas como slug final.
- Si el nombre genera slug vacio, se usa `lugar` con sufijo incremental.
- Slugs duplicados reciben sufijo incremental.
- Open Graph/Twitter usan la URL corta.
- La ruta legacy `/microsites/:slug` sigue funcionando para compatibilidad.

## Fuera de alcance

- Tabla de redirects historicos para slugs antiguos.
- Editor manual de slug para duenos.
