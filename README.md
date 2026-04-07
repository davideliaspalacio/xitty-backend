# Xitty Backend

Plataforma de turismo para Barranquilla, Colombia. Backend construido con NestJS + Supabase, siguiendo arquitectura hexagonal modular.

## Stack

- **Framework**: NestJS (TypeScript estricto)
- **Base de datos**: Supabase (Postgres + PostGIS)
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Storage**: Supabase Storage (imágenes de perfil, lugares, reseñas)
- **Cliente de datos**: `@supabase/supabase-js` (sin Prisma, sin TypeORM)
- **Validación**: `class-validator` + `class-transformer`
- **Documentación API**: Swagger (`@nestjs/swagger`)
- **Testing**: Jest

## Tipos de usuario

1. **Turista** (usuario final): consume contenido, reseña, guarda favoritos
2. **Dueño de negocio**: gestiona micrositio, promociones, métricas
3. **Admin de Xitty**: equipo interno, curación, moderación

Los roles se manejan vía RLS en Supabase + un guard de roles en NestJS.

## Instalación

```bash
# 1. Clonar e instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# 3. Aplicar migraciones a Supabase
npx supabase db push

# 4. Generar tipos TypeScript desde el schema
npx supabase gen types typescript --linked > src/core/types/database.types.ts

# 5. Correr en desarrollo
npm run start:dev
```

La API queda en `http://localhost:3000` y Swagger en `http://localhost:3000/api/docs`.

## Estructura del proyecto

```
src/
├── core/                  # Compartido, sin lógica de negocio
│   ├── config/            # Configuración + validación de env
│   ├── supabase/          # Cliente Supabase compartido
│   ├── common/            # Decorators, guards, filters, pipes
│   └── types/             # Tipos generados desde Supabase
│
├── modules/               # Un módulo por dominio (auth, users, places, etc.)
│   └── <module>/
│       ├── application/   # Services (casos de uso)
│       ├── domain/        # Entidades + interfaces de repositorio
│       ├── infrastructure/# Implementaciones (Supabase repos)
│       ├── presentation/  # Controllers + DTOs HTTP
│       └── <module>.module.ts
│
├── shared/                # Utilidades cross-module sin negocio
├── app.module.ts
└── main.ts
```

Ver [docs/architecture.md](./docs/architecture.md) para la explicación completa.

## Documentación

- [Arquitectura](./docs/architecture.md) — principios hexagonales aplicados
- [Convenciones](./docs/conventions.md) — naming, estructura de archivos, estilo
- [Historias de usuario](./docs/user-stories.md) — las 46 historias del proyecto
- [Agregar un módulo](./docs/adding-a-module.md) — guía paso a paso

## Estado de implementación

### Fase 1 (Marzo - Abril 2026)
- [x] **M1 — Autenticación + Onboarding** (5 historias)
  - [x] US-001 — Registro email/password + Google OAuth
  - [ ] US-002 — Wizard de preferencias
  - [ ] US-003 — Editar perfil y preferencias
  - [ ] US-004 — Recuperar contraseña
  - [ ] US-005 — Ver perfil con historial
- [ ] **M2 — Geolocalización + Mapas** (5 historias)
- [ ] **M3 — Directorio de Lugares** (6 historias)

### Fase 2 (Abril - Mayo 2026)
- [ ] **M4 — AI Chat Guide** (4 historias)
- [ ] **M5 — Micrositios de Negocios** (5 historias)

### Fase 3 (Mayo - Junio 2026)
- [ ] **M6 — Motor de Recomendación AI** (4 historias)
- [ ] **M7 — Ranking + Contenido Destacado** (3 historias)
- [ ] **M8 — Seguridad** (3 historias)

### Fase 4 (Junio 2026)
- [ ] **M9 — Gamificación QR** (4 historias)
- [ ] **M10 — Experiencias** (4 historias)
- [ ] **M11 — Plan Personalizado** (3 historias)

## Configuración requerida en Supabase Dashboard

Estos pasos son manuales y deben hacerse en el dashboard de Supabase:

### Auth
- Habilitar provider de **Email** (con confirmación de email obligatoria)
- Habilitar provider de **Google OAuth** y configurar `Client ID` + `Client Secret`
- Configurar **Redirect URLs**: `http://localhost:3000/auth/google/callback` (dev) y la URL de prod
- Personalizar templates de email: confirmación, recovery, magic link

### Storage
- Crear bucket `avatars` (público para lectura, escritura solo del dueño)
- Crear bucket `places` (público para lectura, escritura solo de admins/dueños)
- Crear bucket `reviews` (público para lectura, escritura del autor)

### Database
- Habilitar extensión **PostGIS** (para M2 - geolocalización)
- Las migraciones SQL se aplican con `npx supabase db push`

## Scripts útiles

```bash
npm run start:dev          # Desarrollo con hot reload
npm run build              # Build de producción
npm run test               # Tests unitarios
npm run test:e2e           # Tests end-to-end
npm run lint               # Linter
npm run format             # Prettier
npx supabase db push       # Aplicar migraciones
npx supabase gen types typescript --linked > src/core/types/database.types.ts
```