# CLAUDE.md

Este archivo se carga automáticamente al iniciar Claude Code en este repo. Contiene el contexto esencial para trabajar en Xitty.

## Qué es Xitty

Plataforma de turismo para Barranquilla, Colombia. 46 historias de usuario en 11 módulos, distribuidas en 4 fases de desarrollo (marzo - junio 2026). Tres tipos de usuarios: turista, dueño de negocio, admin.

## Stack (NO cambiar nada de esto)

- NestJS + TypeScript estricto
- Supabase (Postgres + PostGIS) como única fuente de datos
- Supabase Auth para autenticación (email/password + Google OAuth)
- Supabase Storage para imágenes
- `@supabase/supabase-js` como cliente (NO Prisma, NO TypeORM, NO Passport)
- `class-validator` + `class-transformer` para validación
- `@nestjs/swagger` para documentación
- Jest para testing

## Arquitectura: Modular Hexagonal Ligera

Cada módulo en `src/modules/<nombre>/` tiene 4 capas:

```
modules/<module>/
├── domain/                # Entidades + interfaces de repositorio (puertos)
│   ├── entities/
│   └── repositories/      # SOLO interfaces, nunca implementaciones
├── application/           # Services con casos de uso (lógica de negocio)
├── infrastructure/        # Implementaciones concretas (adaptadores)
│   └── supabase/          # Repos que usan supabase-js
├── presentation/          # Controllers HTTP + DTOs
│   ├── dto/
│   └── <module>.controller.ts
└── <module>.module.ts
```

### Reglas inviolables

1. **`domain/` no importa nada de NestJS, Supabase, ni HTTP.** Es puro TypeScript.
2. **`application/` recibe puertos por DI**, nunca implementaciones concretas. Usa tokens de inyección.
3. **`infrastructure/` implementa los puertos** definidos en `domain/`.
4. **`presentation/` es una capa fina**. Controllers solo: validan input → llaman service → formatean response.
5. **DTOs HTTP nunca son entidades de dominio**. Mapeá explícitamente.
6. **Módulos no se importan entre sí directamente.** Solo a través de servicios públicos exportados desde `<module>.module.ts`.
7. **Toda tabla nueva tiene RLS activado** desde el primer momento.

## Convenciones de código

### Naming
- Archivos: `kebab-case.tipo.ts` → `register-user.service.ts`, `auth.controller.ts`
- Clases: `PascalCase` → `RegisterUserService`, `AuthController`
- Interfaces de puerto: prefijo `I` → `IAuthRepository`, `IUserRepository`
- Tokens DI: `SCREAMING_SNAKE_CASE` constante exportada → `AUTH_REPOSITORY`
- DTOs: sufijo `Dto` → `RegisterUserDto`, `LoginResponseDto`
- Entidades de dominio: sin sufijo → `User`, `Profile`, `Place`

### Estructura de un service
```typescript
@Injectable()
export class RegisterUserService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepo: IAuthRepository,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    // lógica de negocio
  }
}
```

### Estructura de un repo Supabase
```typescript
@Injectable()
export class SupabaseAuthRepository implements IAuthRepository {
  constructor(private readonly supabase: SupabaseService) {}
  // implementación
}
```

### Registro en el module
```typescript
@Module({
  controllers: [AuthController],
  providers: [
    RegisterUserService,
    LoginUserService,
    {
      provide: AUTH_REPOSITORY,
      useClass: SupabaseAuthRepository,
    },
  ],
  exports: [RegisterUserService],
})
export class AuthModule {}
```

## Antes de implementar cualquier historia

1. Leé `docs/user-stories.md` y ubicá la historia con sus criterios de aceptación
2. Revisá módulos existentes en `src/modules/` para copiar el patrón
3. Si la historia toca otro módulo, no metas lógica cruzada — exportá un service desde el otro módulo
4. Si necesitás tablas nuevas, creá la migración SQL primero, después regenerá tipos
5. Endpoints siempre con decoradores Swagger completos (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)
6. Cada service nuevo lleva al menos un test unitario básico

## Flujo de implementación recomendado

Cuando recibas una tarea de "implementá US-XXX":

1. **Plan primero, código después.** Mostrá qué archivos vas a crear/modificar antes de tocar nada.
2. **Migraciones SQL** (con RLS) → aplicar → regenerar tipos
3. **Domain** (entidades + interfaces de repo)
4. **Infrastructure** (implementaciones Supabase)
5. **Application** (services)
6. **Presentation** (controllers + DTOs)
7. **Registrar en el module**
8. **Tests unitarios mínimos**
9. **Actualizar README.md** marcando la historia como hecha

## Errores comunes a evitar

- Importar `@supabase/supabase-js` en `domain/` → ❌ rompe la arquitectura
- Devolver entidades de dominio directamente en controllers → ❌ usar DTOs de respuesta
- Hacer queries Supabase desde controllers → ❌ siempre via service → repo
- Olvidar RLS en tablas nuevas → ❌ riesgo de seguridad
- Crear módulos "utils" gigantes → ❌ usar `shared/` solo para utilidades puras
- Mezclar lógica de auth con lógica de perfil → ❌ son módulos separados (`auth/` y `users/`)

## Configuración Supabase requerida

Ver sección "Configuración requerida en Supabase Dashboard" en README.md raíz. Si una historia requiere configuración manual nueva, documentala ahí.