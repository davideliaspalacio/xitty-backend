# Xitty Backend

Plataforma de turismo para Barranquilla, Colombia. Backend NestJS + Supabase.

> ⚠️ **Estado actual:** solo el módulo **auth** está implementado. Es el punto de partida del backend y se irán agregando los demás módulos sobre esta base.

## Stack

- **Framework:** NestJS (TypeScript)
- **Base de datos:** Supabase (Postgres)
- **Auth:** Supabase Auth + JWT propio firmado con `jsonwebtoken`
- **Validación:** `class-validator` + `class-transformer`
- **Documentación API:** Swagger (`@nestjs/swagger`) en `/api/docs`
- **Rate limiting:** `@nestjs/throttler` (5 req/min en login y register)
- **Security headers:** `helmet`
- **Testing:** Jest

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales reales

# 3. Levantar en desarrollo
npm run start:dev
```

La API queda en `http://localhost:3001` y Swagger en `http://localhost:3001/api/docs`.

## Variables de entorno

```env
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

JWT_SECRET=cambia-esto-en-produccion
```

| Variable | Para qué |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (uso desde backend, **NO** del frontend) |
| `JWT_SECRET` | Secret para firmar los tokens propios |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma |
| `PORT` | Puerto del servidor (default 3001) |

## Estructura del proyecto

```
src/
├── config/                       # Wiring de Supabase
│   ├── database.module.ts
│   └── supabase.config.ts
├── common/                       # Guards y DTOs compartidos
│   ├── dto/
│   │   └── pagination.dto.ts
│   └── guards/
│       └── auth.guard.ts
├── modules/
│   └── auth/                     # Único módulo activo por ahora
│       ├── dto/
│       │   ├── login.dto.ts
│       │   ├── register.dto.ts
│       │   └── auth-response.dto.ts
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       └── auth.module.ts
├── app.module.ts
└── main.ts
```

## Endpoints del módulo auth

Todos bajo el prefijo `/auth`. Documentación interactiva completa en `/api/docs`.

### `POST /auth/register`

Registra un usuario en Supabase Auth, crea el perfil en `profiles` y le asigna rol `user`.

```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "phone": "+573001234567"
}
```

**Respuesta 201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone": "+573001234567",
    "role": "user"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

Rate limit: 5 req/min.

### `POST /auth/login`

```json
{ "email": "user@example.com", "password": "password123" }
```

Devuelve el mismo shape que `/register`. Rate limit: 5 req/min.

### `GET /auth/me`

Header: `Authorization: Bearer <access_token>`. Devuelve el perfil del usuario actual.

### `POST /auth/logout`

Stub. El cliente debe descartar el token (en una versión futura se podría implementar blacklist en Redis).

### `GET /auth/admin/users?page=1&limit=10`

Solo accesible por usuarios con `role = 'admin'`. Lista paginada de perfiles.

## Cómo funciona el auth

1. El usuario hace `POST /auth/register` o `POST /auth/login`.
2. El backend usa el SDK de Supabase para autenticar contra Supabase Auth.
3. El backend lee el rol desde la tabla `profiles` y firma **su propio JWT** con `JWT_SECRET`:
   - `access_token`: payload `{ sub, role, type: 'access' }`, expira en 1h
   - `refresh_token`: payload `{ sub, type: 'refresh' }`, expira en 7d
4. Las rutas protegidas usan `AuthGuard` (`src/common/guards/auth.guard.ts`) que verifica el JWT y popula `req.user = { id, role, email }`.

> El JWT que devuelve la API **no** es el de Supabase, es uno propio. Esto da control total sobre claims y expiración.

## Tablas requeridas en Supabase

El módulo asume que existen estas tablas en el schema `public`:

### `profiles`
| columna | tipo |
|---|---|
| `id` | `uuid` (PK, FK a `auth.users.id`) |
| `email` | `text` |
| `full_name` | `text` |
| `phone` | `text` |
| `role` | `text` (default `'user'`) |
| `created_at` | `timestamptz` |
| `updated_at` | `timestamptz` |

### `user_roles`
| columna | tipo |
|---|---|
| `user_id` | `uuid` (FK a `auth.users.id`) |
| `role` | `text` |
| `created_at` | `timestamptz` |

> Las migraciones existentes en `supabase/migrations/` corresponden a una versión anterior del backend y deberán adaptarse cuando se conecten al nuevo módulo.

## Scripts útiles

```bash
npm run start:dev          # Desarrollo con hot reload
npm run start              # Desarrollo sin watch
npm run start:prod         # Producción (requiere build previo)
npm run build              # Compilar a dist/
npm run test               # Tests unitarios
npm run lint               # Linter
npm run format             # Prettier
```
