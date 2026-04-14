# CLAUDE.md

Este archivo se carga automáticamente al iniciar Claude Code en este repo. Contiene el contexto esencial para trabajar en Xitty.

## Qué es Xitty

Plataforma de turismo para Barranquilla, Colombia. Backend en NestJS + Supabase. Tres tipos de usuarios: turista, dueño de negocio, admin.

> ⚠️ **Estado actual:** el backend está reseteado al **mínimo viable**. Solo el módulo `auth` está implementado. El resto de los módulos (places, reviews, etc.) se irán agregando uno a uno.

## Stack

- NestJS + TypeScript
- Supabase (Postgres) accedido vía `@supabase/supabase-js` con la **Service Role Key** desde el backend
- Supabase Auth para `signUp` / `signInWithPassword`
- **JWT propio** firmado con `jsonwebtoken` para los access/refresh tokens que devuelve la API (no se usa el JWT de Supabase directamente)
- `class-validator` + `class-transformer` para validar DTOs
- `@nestjs/swagger` para documentación
- `@nestjs/throttler` para rate limit en endpoints sensibles
- `helmet` para security headers
- Jest para testing

## Arquitectura: módulos planos al estilo NestJS clásico

```
src/
├── config/
│   ├── database.module.ts        # Provee SUPABASE_CLIENT
│   └── supabase.config.ts        # Factory que crea el SupabaseClient
├── common/
│   ├── dto/
│   │   └── pagination.dto.ts
│   └── guards/
│       └── auth.guard.ts          # Verifica el JWT propio (Bearer token)
├── modules/
│   └── auth/
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

### Reglas

1. **Un service por módulo**, sin separar domain/infrastructure. Los services hablan directamente con Supabase a través del `SUPABASE_CLIENT` inyectado.
2. **Controllers son finos**: validan input → llaman al service → devuelven la respuesta.
3. **DTOs en `dto/`** dentro de cada módulo. Llevan decoradores `@ApiProperty` para Swagger y `class-validator` para validación.
4. **El cliente Supabase se inyecta con el token `'SUPABASE_CLIENT'`** (string), provisto por `DatabaseModule`.
5. **Auth = JWT propio firmado con `JWT_SECRET`**. El `AuthGuard` (`src/common/guards/auth.guard.ts`) lee el header `Authorization: Bearer <token>`, verifica firma y tipo (`access`), y mete `req.user = { id, role, email }`.
6. **Endpoints sensibles** (`login`, `register`) van detrás de `ThrottlerGuard` (`@nestjs/throttler`) — ya configurado en `auth.module.ts`.
7. **Documentación Swagger** en `/api/docs`. Todo endpoint nuevo lleva `@ApiTags`, `@ApiOperation`, `@ApiResponse`.

## Convenciones de código

### Naming
- Archivos: `kebab-case.tipo.ts` → `auth.service.ts`, `login.dto.ts`
- Clases: `PascalCase` → `AuthService`, `LoginDto`
- Tablas en Supabase: `snake_case` → `profiles`, `user_roles`

### Estructura de un service

```typescript
@Injectable()
export class AuthService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });
    if (error) throw new UnauthorizedException('Invalid email or password');
    // …
  }
}
```

### Estructura de un module

```typescript
@Module({
  imports: [DatabaseModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }])],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

## Cómo agregar un módulo nuevo

1. Crear `src/modules/<nombre>/` con `dto/`, `<nombre>.module.ts`, `<nombre>.controller.ts`, `<nombre>.service.ts`.
2. Importar `DatabaseModule` en el `imports` del module si necesita Supabase.
3. Inyectar `@Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient` en el service.
4. Registrar el module en `AppModule` (`src/app.module.ts`).
5. Documentar todos los endpoints con decoradores Swagger.
6. Si el endpoint necesita auth: `@UseGuards(AuthGuard)` + `@ApiBearerAuth()`.
7. Tabla nueva en Supabase: crear migración SQL en `supabase/migrations/` y activar RLS.

## Variables de entorno

Ver `.env.example`. Las imprescindibles:

| Var | Para qué |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (¡no exponer al frontend!) |
| `JWT_SECRET` | Secret para firmar los access/refresh tokens propios |
| `CORS_ORIGIN` | Lista separada por comas de orígenes permitidos |
| `PORT` | Puerto del servidor (default 3001) |

## Errores comunes a evitar

- ❌ Exponer la `SERVICE_ROLE_KEY` en código del frontend o en logs.
- ❌ Confiar en el JWT de Supabase en el `AuthGuard` — el guard valida el JWT **propio** (firmado con `JWT_SECRET`), no el de Supabase.
- ❌ Olvidar `@UseGuards(AuthGuard)` + `@ApiBearerAuth()` en endpoints privados.
- ❌ Crear tablas sin RLS.
- ❌ Devolver objetos del cliente Supabase crudos en los controllers — armar el response con la forma del DTO.

## Referencia rápida de endpoints actuales

| Método | Path | Auth | Rate limit | Descripción |
|---|---|---|---|---|
| `POST` | `/auth/register` | público | 5/min | Registra usuario en Supabase + perfil + rol `user` |
| `POST` | `/auth/login` | público | 5/min | Login con email/password, devuelve JWT propio |
| `GET`  | `/auth/me` | Bearer | — | Devuelve perfil del usuario actual |
| `POST` | `/auth/logout` | público | — | Stub (el cliente debe descartar el token) |
| `GET`  | `/auth/admin/users` | Bearer (rol admin) | — | Lista paginada de usuarios |
