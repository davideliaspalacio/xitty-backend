# Convenciones de código

## Naming

| Tipo | Convención | Ejemplo |
|---|---|---|
| Archivos | `kebab-case.tipo.ts` | `register-user.service.ts` |
| Clases | `PascalCase` | `RegisterUserService` |
| Interfaces de puerto | prefijo `I` + `PascalCase` | `IAuthRepository` |
| Tokens DI | `SCREAMING_SNAKE_CASE` constante | `AUTH_REPOSITORY` |
| Variables/funciones | `camelCase` | `registerUser`, `currentUser` |
| Constantes | `SCREAMING_SNAKE_CASE` | `MAX_LOGIN_ATTEMPTS` |
| Enums | `PascalCase` con valores `SCREAMING_SNAKE_CASE` | `TravelerType.NOMADA` |
| DTOs | sufijo `Dto` | `RegisterUserDto`, `UserResponseDto` |
| Entidades de dominio | sin sufijo | `User`, `Place`, `Profile` |
| Errores de dominio | sufijo `Error` | `RegistrationFailedError` |

## Sufijos de archivos por tipo

- `.entity.ts` — entidad de dominio
- `.repository.ts` — interface de repositorio (puerto)
- `.service.ts` — service de aplicación
- `.controller.ts` — controller HTTP
- `.dto.ts` — DTO de request o response
- `.guard.ts` — guard de NestJS
- `.decorator.ts` — decorador custom
- `.filter.ts` — exception filter
- `.pipe.ts` — pipe de validación/transformación
- `.module.ts` — módulo de NestJS
- `.error.ts` — clase de error de dominio
- `.spec.ts` — test unitario
- `.e2e-spec.ts` — test end-to-end

## Estructura de un service de aplicación

Un service = un caso de uso. Si tu service hace dos cosas, partilo en dos.

```typescript
@Injectable()
export class RegisterUserService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepo: IAuthRepository,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    // 1. Validaciones de negocio (no de formato — eso es DTO)
    // 2. Llamadas a repos
    // 3. Devolver entidad de dominio
  }
}
```

**El método público se llama `execute`** por convención. Un service = una operación.

Si necesitás varios métodos relacionados (ej: CRUD), mejor crear varios services pequeños:
- `CreatePlaceService.execute()`
- `UpdatePlaceService.execute()`
- `DeletePlaceService.execute()`
- `GetPlaceByIdService.execute()`
- `ListPlacesService.execute()`

## Estructura de un controller

```typescript
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserService,
    private readonly loginUser: LoginUserService,
  ) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Registra un nuevo turista' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async register(@Body() dto: RegisterUserDto): Promise<UserResponseDto> {
    const user = await this.registerUser.execute(dto);
    return UserResponseDto.fromDomain(user);
  }
}
```

**Reglas:**
- Un decorador Swagger por response code esperado
- Mensaje de `@ApiOperation` en español (es la audiencia)
- Siempre `HttpCode` explícito si no es el default
- Nunca devolver entidades de dominio directamente

## DTOs

### Request DTOs
```typescript
export class RegisterUserDto {
  @IsEmail()
  @ApiProperty({ example: 'turista@xitty.co' })
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @ApiProperty({ minLength: 8, maxLength: 72 })
  password: string;
}
```

### Response DTOs
```typescript
export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  emailVerified: boolean;

  static fromDomain(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.emailVerified = user.emailVerified;
    return dto;
  }
}
```

**Siempre tener un `fromDomain()` estático** para mapear entidad → DTO. No mezclar en los controllers.

## Manejo de errores

### Errores de dominio
```typescript
// domain/errors/email-already-registered.error.ts
export class EmailAlreadyRegisteredError extends Error {
  constructor(email: string) {
    super(`Email ${email} ya está registrado`);
    this.name = 'EmailAlreadyRegisteredError';
  }
}
```

### Mapeo a HTTP
El `GlobalExceptionFilter` en `core/common/filters/` traduce errores de dominio a HTTP status codes. No tirar `HttpException` desde los services.

## Migraciones SQL

Viven en `supabase/migrations/`. Naming: `<timestamp>_<descripcion>.sql`.

```sql
-- supabase/migrations/20260326000001_create_profiles.sql

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS siempre activado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve y modifica su propio perfil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

## Imports

Orden de imports en cada archivo:
```typescript
// 1. NestJS y librerías externas
import { Injectable, Inject } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

// 2. Imports absolutos del proyecto (core, shared)
import { SupabaseService } from '@/core/supabase/supabase.service';

// 3. Imports relativos del módulo
import { IAuthRepository, AUTH_REPOSITORY } from '../domain/repositories/auth.repository';
import { User } from '../domain/entities/user.entity';
```

Usar el alias `@/` para imports absolutos desde `src/`. Configurar en `tsconfig.json`.

## Comentarios

- **TODO**: tareas pendientes con contexto. Formato: `// TODO(US-XXX): descripción`
- **FIXME**: bugs conocidos. Formato: `// FIXME: descripción`
- **NOTE**: contexto importante para el lector. Formato: `// NOTE: descripción`

No comentar lo obvio. Si el código necesita explicación, probablemente necesite refactor.

## Tests

- Un `.spec.ts` por service como mínimo
- Mockear puertos, no implementaciones
- AAA pattern: Arrange, Act, Assert

```typescript
describe('RegisterUserService', () => {
  let service: RegisterUserService;
  let authRepo: jest.Mocked<IAuthRepository>;

  beforeEach(() => {
    authRepo = {
      registerWithEmail: jest.fn(),
      // ...
    };
    service = new RegisterUserService(authRepo);
  });

  it('should register a new user with email', async () => {
    // Arrange
    const input = { email: 'test@xitty.co', password: 'password123' };
    authRepo.registerWithEmail.mockResolvedValue(new User('id-1', input.email, false, new Date()));

    // Act
    const user = await service.execute(input);

    // Assert
    expect(user.email).toBe(input.email);
    expect(authRepo.registerWithEmail).toHaveBeenCalledWith(input.email, input.password);
  });
});
```