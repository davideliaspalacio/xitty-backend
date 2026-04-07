# Cómo agregar un nuevo módulo

Esta guía describe el proceso paso a paso para agregar un módulo nuevo siguiendo la arquitectura de Xitty. Es la referencia que el AI debe seguir al implementar cualquiera de los 10 módulos pendientes.

## Antes de empezar

1. Identificá el módulo en `docs/user-stories.md`
2. Listá las historias que pertenecen al módulo
3. Identificá dependencias con otros módulos (¿necesita acceder a `users`? ¿`places`?)
4. Decidí qué entidades de dominio necesitás
5. Decidí qué tablas nuevas en Supabase necesitás

## Paso 1: Migraciones SQL

Crear archivo en `supabase/migrations/<timestamp>_<descripcion>.sql`.

```sql
-- Crear tabla
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX places_location_idx ON places USING GIST (location);
CREATE INDEX places_category_idx ON places (category);

-- RLS SIEMPRE
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Anyone can read places"
  ON places FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert places"
  ON places FOR INSERT
  WITH CHECK (is_admin(auth.uid()));
```

Aplicar:
```bash
npx supabase db push
```

Regenerar tipos:
```bash
npx supabase gen types typescript --linked > src/core/types/database.types.ts
```

## Paso 2: Crear estructura del módulo

```bash
src/modules/places/
├── application/
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── errors/
├── infrastructure/
│   └── supabase/
├── presentation/
│   └── dto/
└── places.module.ts
```

## Paso 3: Domain

### Entidades

```typescript
// src/modules/places/domain/entities/place.entity.ts
export class Place {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly category: PlaceCategory,
    public readonly location: { lat: number; lng: number },
    public readonly createdAt: Date,
  ) {}
}

export enum PlaceCategory {
  RESTAURANT = 'RESTAURANT',
  TOURIST_SITE = 'TOURIST_SITE',
  EXPERIENCE = 'EXPERIENCE',
}
```

### Interfaces de repositorio

```typescript
// src/modules/places/domain/repositories/place.repository.ts
export const PLACE_REPOSITORY = Symbol('PLACE_REPOSITORY');

export interface IPlaceRepository {
  findById(id: string): Promise<Place | null>;
  findNearby(lat: number, lng: number, radiusMeters: number): Promise<Place[]>;
  create(place: Omit<Place, 'id' | 'createdAt'>): Promise<Place>;
}
```

### Errores de dominio

```typescript
// src/modules/places/domain/errors/place-not-found.error.ts
export class PlaceNotFoundError extends Error {
  constructor(id: string) {
    super(`Place with id ${id} not found`);
    this.name = 'PlaceNotFoundError';
  }
}
```

## Paso 4: Infrastructure

```typescript
// src/modules/places/infrastructure/supabase/supabase-place.repository.ts
@Injectable()
export class SupabasePlaceRepository implements IPlaceRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findById(id: string): Promise<Place | null> {
    const { data, error } = await this.supabase.client
      .from('places')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return this.toDomain(data);
  }

  private toDomain(row: Database['public']['Tables']['places']['Row']): Place {
    return new Place(
      row.id,
      row.name,
      row.description,
      row.category as PlaceCategory,
      this.parseLocation(row.location),
      new Date(row.created_at),
    );
  }
}
```

## Paso 5: Application

Un service por caso de uso:

```typescript
// src/modules/places/application/get-place-by-id.service.ts
@Injectable()
export class GetPlaceByIdService {
  constructor(
    @Inject(PLACE_REPOSITORY)
    private readonly placeRepo: IPlaceRepository,
  ) {}

  async execute(id: string): Promise<Place> {
    const place = await this.placeRepo.findById(id);
    if (!place) throw new PlaceNotFoundError(id);
    return place;
  }
}
```

## Paso 6: Presentation

### DTOs

```typescript
// src/modules/places/presentation/dto/place-response.dto.ts
export class PlaceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  category: string;

  static fromDomain(place: Place): PlaceResponseDto {
    const dto = new PlaceResponseDto();
    dto.id = place.id;
    dto.name = place.name;
    dto.category = place.category;
    return dto;
  }
}
```

### Controller

```typescript
// src/modules/places/presentation/places.controller.ts
@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(
    private readonly getPlaceById: GetPlaceByIdService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un lugar' })
  @ApiResponse({ status: 200, type: PlaceResponseDto })
  @ApiResponse({ status: 404, description: 'Lugar no encontrado' })
  async findOne(@Param('id') id: string): Promise<PlaceResponseDto> {
    const place = await this.getPlaceById.execute(id);
    return PlaceResponseDto.fromDomain(place);
  }
}
```

## Paso 7: Module

```typescript
// src/modules/places/places.module.ts
@Module({
  imports: [SupabaseModule],
  controllers: [PlacesController],
  providers: [
    GetPlaceByIdService,
    {
      provide: PLACE_REPOSITORY,
      useClass: SupabasePlaceRepository,
    },
  ],
  exports: [GetPlaceByIdService],
})
export class PlacesModule {}
```

## Paso 8: Registrar en AppModule

```typescript
// src/app.module.ts
@Module({
  imports: [
    // ... otros módulos
    PlacesModule,
  ],
})
export class AppModule {}
```

## Paso 9: Tests

```typescript
// test/unit/modules/places/get-place-by-id.service.spec.ts
describe('GetPlaceByIdService', () => {
  let service: GetPlaceByIdService;
  let repo: jest.Mocked<IPlaceRepository>;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      findNearby: jest.fn(),
      create: jest.fn(),
    };
    service = new GetPlaceByIdService(repo);
  });

  it('should return a place when found', async () => {
    const mockPlace = new Place('id-1', 'Test', null, PlaceCategory.RESTAURANT, { lat: 0, lng: 0 }, new Date());
    repo.findById.mockResolvedValue(mockPlace);

    const result = await service.execute('id-1');

    expect(result).toEqual(mockPlace);
  });

  it('should throw PlaceNotFoundError when not found', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.execute('id-1')).rejects.toThrow(PlaceNotFoundError);
  });
});
```

## Paso 10: Actualizar README

Marcar las historias del módulo como completadas en `README.md`.

## Checklist final

- [ ] Migraciones SQL aplicadas con RLS
- [ ] Tipos regenerados desde Supabase
- [ ] Domain sin imports de NestJS/Supabase
- [ ] Application services pequeños (uno por caso de uso)
- [ ] Infrastructure mapea correctamente entidad ↔ row
- [ ] Controllers usan DTOs, no entidades
- [ ] Decoradores Swagger completos
- [ ] Module registra providers con tokens DI
- [ ] Module se importa en AppModule
- [ ] Al menos un test unitario por service
- [ ] README actualizado