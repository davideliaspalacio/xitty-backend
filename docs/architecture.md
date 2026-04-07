# Arquitectura

Xitty usa **arquitectura hexagonal modular ligera**. "Ligera" porque no aplicamos DDD táctico completo (no hay agregados, value objects elaborados, ni eventos de dominio) — solo los principios que importan para mantener el código testeable, predecible y desacoplado de la infraestructura.

## Por qué hexagonal

Tres razones concretas:

1. **AI-assisted development**: si la estructura es predecible, el AI replica patrones bien. Si es libre, cada feature termina diferente.
2. **Supabase como dependencia externa**: queremos poder cambiar de proveedor sin reescribir la lógica de negocio. Las queries de Supabase viven en una sola capa.
3. **Testing**: la lógica de negocio se testea sin levantar Supabase, mockeando los puertos.

## Las 4 capas

### Domain (`domain/`)

El núcleo. Contiene:
- **Entidades**: representan conceptos del negocio (`User`, `Profile`, `Place`, `Review`)
- **Interfaces de repositorio (puertos)**: contratos para acceder a datos (`IAuthRepository`, `IPlaceRepository`)
- **Tipos y enums del dominio**: `TravelerType`, `BudgetRange`, `EnergyLevel`

**Reglas:**
- No importa nada de NestJS, Supabase, ni HTTP
- Es puro TypeScript
- Si lo copiás a otro proyecto, debería compilar sin tocar nada

**Ejemplo:**
```typescript
// domain/entities/user.entity.ts
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly emailVerified: boolean,
    public readonly createdAt: Date,
  ) {}
}

// domain/repositories/auth.repository.ts
export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface IAuthRepository {
  registerWithEmail(email: string, password: string): Promise<User>;
  loginWithEmail(email: string, password: string): Promise<{ user: User; token: string }>;
  getUserByToken(token: string): Promise<User | null>;
}
```

### Application (`application/`)

Casos de uso. Cada service hace UNA cosa.

**Reglas:**
- Recibe puertos por DI (nunca implementaciones concretas)
- Orquesta la lógica de negocio
- No conoce HTTP ni Supabase
- Puede importar tipos del dominio

**Ejemplo:**
```typescript
// application/register-user.service.ts
@Injectable()
export class RegisterUserService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepo: IAuthRepository,
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepo: IProfileRepository,
  ) {}

  async execute(input: { email: string; password: string }): Promise<User> {
    const user = await this.authRepo.registerWithEmail(input.email, input.password);
    await this.profileRepo.create({ userId: user.id });
    return user;
  }
}
```

### Infrastructure (`infrastructure/`)

Implementaciones concretas. Es donde vive Supabase.

**Reglas:**
- Implementa interfaces del dominio
- Mapea entre tipos de Supabase y entidades del dominio
- Es la única capa que importa `@supabase/supabase-js`
- Una subcarpeta por tecnología externa: `supabase/`, `mailer/`, `openai/`, etc.

**Ejemplo:**
```typescript
// infrastructure/supabase/supabase-auth.repository.ts
@Injectable()
export class SupabaseAuthRepository implements IAuthRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async registerWithEmail(email: string, password: string): Promise<User> {
    const { data, error } = await this.supabase.client.auth.signUp({ email, password });
    if (error) throw new RegistrationFailedError(error.message);
    return this.toDomain(data.user);
  }

  private toDomain(supabaseUser: SupabaseUser): User {
    return new User(
      supabaseUser.id,
      supabaseUser.email!,
      supabaseUser.email_confirmed_at !== null,
      new Date(supabaseUser.created_at),
    );
  }
}
```

### Presentation (`presentation/`)

La capa HTTP. Lo más fina posible.

**Reglas:**
- Controllers solo: validan input → llaman service → mapean a DTO de respuesta
- DTOs de request/response viven acá, separados de las entidades
- Decoradores Swagger completos
- Sin lógica de negocio

**Ejemplo:**
```typescript
// presentation/dto/register-user.dto.ts
export class RegisterUserDto {
  @IsEmail()
  @ApiProperty({ example: 'turista@xitty.co' })
  email: string;

  @IsString()
  @MinLength(8)
  @ApiProperty({ minLength: 8 })
  password: string;
}

// presentation/auth.controller.ts
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly registerUser: RegisterUserService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registra un nuevo turista con email y password' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  async register(@Body() dto: RegisterUserDto): Promise<UserResponseDto> {
    const user = await this.registerUser.execute(dto);
    return UserResponseDto.fromDomain(user);
  }
}
```

## Inyección de dependencias

Usamos **tokens** (símbolos exportados) para los puertos. Esto permite que `application/` no conozca la implementación.

```typescript
// domain/repositories/auth.repository.ts
export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

// auth.module.ts
@Module({
  providers: [
    {
      provide: AUTH_REPOSITORY,
      useClass: SupabaseAuthRepository,
    },
  ],
})

// application/register-user.service.ts
constructor(
  @Inject(AUTH_REPOSITORY) private readonly authRepo: IAuthRepository,
) {}
```

Si mañana querés cambiar Supabase Auth por Auth0, solo cambiás `useClass` en el module.

## Comunicación entre módulos

**No** se importan controllers, services o repos directamente entre módulos.

**Sí** se exportan services públicos desde el `<module>.module.ts` y se importan vía `imports: [OtherModule]`.

**Ejemplo válido:**
```typescript
// users.module.ts
@Module({
  exports: [GetUserProfileService],
})
export class UsersModule {}

// places.module.ts
@Module({
  imports: [UsersModule],
})
export class PlacesModule {}

// places service puede inyectar GetUserProfileService
```

## Manejo de errores

Cada módulo define sus propios errores de dominio en `domain/errors/`. Un `GlobalExceptionFilter` los traduce a respuestas HTTP.

```typescript
// domain/errors/registration-failed.error.ts
export class RegistrationFailedError extends Error {
  constructor(message: string) {
    super(`Registration failed: ${message}`);
  }
}

// core/common/filters/global-exception.filter.ts mapea estos errores a HTTP status codes
```

## Row Level Security (RLS)

**Toda tabla nueva debe tener RLS activado desde el momento en que se crea.** No lo dejes para después.

Patrones comunes:
- "El usuario solo ve sus propios registros": `auth.uid() = user_id`
- "Cualquiera puede leer, solo el dueño puede escribir": dos políticas separadas (SELECT pública, INSERT/UPDATE/DELETE con check)
- "Solo admins pueden modificar": función `is_admin(auth.uid())`

Las políticas viven en las migraciones SQL, no en el código TypeScript.

## Testing

- **Unit tests**: para services. Mockear los puertos (interfaces de repo).
- **Integration tests**: para repos Supabase. Apuntar a una DB de test.
- **E2E tests**: para flows críticos (registro, login, recovery).

Estructura de tests espejo de `src/`:
```
src/modules/auth/application/register-user.service.ts
test/unit/modules/auth/register-user.service.spec.ts
```