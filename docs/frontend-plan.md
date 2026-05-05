# Xitty — Plan de Frontend

Plan completo para construir el frontend del backend Xitty. Pensado para que un nuevo agente de Claude pueda recoger este documento y ejecutarlo de principio a fin sin contexto adicional.

---

## 1. Visión

Xitty es una plataforma de turismo para Barranquilla con tres tipos de usuario: **turista**, **dueño de negocio** y **admin**. El backend ya tiene 66 endpoints distribuidos en 13 módulos. El frontend que vamos a construir consume esos endpoints y entrega una experiencia tipo Rappi/Spotify: minimalista, mobile-first, fotos grandes, navegación inferior, transiciones suaves, énfasis visual sobre el contenido.

**Principios:**
- **Mobile-first**: el flujo principal está pensado para celular. Web responsive.
- **Feature-isolated**: cada feature vive en su carpeta con sus componentes, hooks, store, llamadas API y tests. No se importan archivos cruzando features.
- **Server state ≠ Client state**: Zustand para UI/sesión. TanStack Query para estado del servidor (cache, refetch, mutaciones).
- **Tipado estricto**: TypeScript en todo. Tipos compartidos generados desde el OpenAPI del backend.
- **Tests obligatorios**: ningún feature se da por terminado sin pruebas unitarias + al menos un E2E del happy path.
- **Diseño Rappi-style**: bottom tabs, cards con foto dominante, search prominente, chips horizontales, sheets bottom-up, accents fuertes sobre base neutra.

---

## 2. Stack Técnico

| Capa | Herramienta | Por qué |
|------|-------------|---------|
| Framework | **Next.js 14+ (App Router)** | SSR/RSC, routing por carpetas, optimización automática |
| Lenguaje | **TypeScript estricto** | Seguridad de tipos, autocompletado con el cliente generado |
| Estado UI/sesión | **Zustand** | Simple, sin boilerplate, persiste fácil con middleware |
| Estado servidor | **TanStack Query (React Query v5)** | Cache, refetch, optimistic updates, stale-while-revalidate |
| HTTP | **Cliente generado desde OpenAPI** (openapi-typescript-codegen) | Tipos exactos del backend, refactor seguro |
| Estilos | **Tailwind CSS + tokens de diseño** | Velocidad, consistencia, dark mode trivial |
| Componentes base | **shadcn/ui** (Radix headless + Tailwind) | Accesibles, customizables, no se acoplan a una lib pesada |
| Forms | **React Hook Form + Zod** | Validación tipada, performance, integración con shadcn |
| Iconos | **Lucide React** | Ligeros, consistentes, paquete pequeño |
| Animaciones | **Framer Motion** | Transiciones de pantalla, sheets, gestos |
| Imágenes | `next/image` + Supabase Storage | Lazy load, optimización automática |
| Tests unitarios | **Vitest + Testing Library** | Rápido, compatible con Vite/Next, API igual a Jest |
| Tests E2E | **Playwright** | Soporta mobile viewport, screenshots, traces |
| Mocks API | **MSW (Mock Service Worker)** | Mismos handlers en tests y dev sin backend |
| Lint/Format | **ESLint + Prettier + lint-staged** | Calidad consistente |
| Pre-commit | **Husky** | Bloquea commits sin lint/test |
| Deploy | **Vercel** | Integración nativa con Next.js, previews por PR |

---

## 3. Estructura de Carpetas (Feature-Based)

```
xitty-frontend/
├── src/
│   ├── app/                          # Next.js App Router (solo rutas, sin lógica)
│   │   ├── (public)/                 # Rutas sin auth
│   │   │   ├── page.tsx              # Home / discover
│   │   │   ├── places/[id]/page.tsx
│   │   │   ├── experiences/[id]/page.tsx
│   │   │   ├── microsites/[slug]/page.tsx
│   │   │   └── login/page.tsx
│   │   ├── (tourist)/                # Rutas que requieren rol "user" o auth básica
│   │   │   ├── favorites/page.tsx
│   │   │   ├── reservations/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── (business)/               # Dashboard del dueño de negocio
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── places/[id]/edit/page.tsx
│   │   │   ├── promotions/page.tsx
│   │   │   ├── metrics/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── (admin)/                  # Panel admin
│   │   │   ├── sponsorships/page.tsx
│   │   │   ├── featured/page.tsx
│   │   │   ├── local-picks/page.tsx
│   │   │   └── users/page.tsx
│   │   ├── api/                      # Route handlers de Next (proxy si hace falta)
│   │   ├── layout.tsx                # Layout root (providers)
│   │   ├── globals.css
│   │   └── not-found.tsx
│   │
│   ├── features/                     # ⭐ Cada feature es independiente
│   │   ├── auth/
│   │   ├── onboarding/
│   │   ├── discover/                 # Home con secciones curadas
│   │   ├── places/
│   │   ├── reviews/
│   │   ├── favorites/
│   │   ├── microsites/
│   │   ├── promotions/
│   │   ├── metrics/
│   │   ├── notification-settings/
│   │   ├── ranking/
│   │   ├── featured/
│   │   ├── experiences/
│   │   ├── reservations/
│   │   ├── local-picks/
│   │   └── admin/
│   │
│   ├── shared/                       # Reusable cross-feature (sin lógica de negocio)
│   │   ├── ui/                       # Design system: Button, Card, Sheet, Input...
│   │   ├── icons/
│   │   ├── layout/                   # Header, BottomNav, Container
│   │   ├── utils/                    # formatPrice, formatDate, slug, etc
│   │   ├── hooks/                    # useDebounce, useMediaQuery, useGeolocation
│   │   └── types/                    # Tipos globales (Role, ApiError)
│   │
│   ├── lib/
│   │   ├── api/                      # Cliente generado desde OpenAPI (no editar a mano)
│   │   ├── query-client.ts           # Setup de TanStack Query
│   │   ├── supabase-storage.ts       # Helpers para subir fotos a Supabase Storage
│   │   ├── analytics.ts              # Wrapper de eventos
│   │   └── env.ts                    # Validación de env vars con Zod
│   │
│   ├── styles/
│   │   └── tokens.css                # CSS vars: colores, spacing, typography
│   │
│   └── tests/
│       ├── e2e/                      # Playwright
│       ├── setup.ts                  # MSW + jsdom setup
│       └── mocks/                    # Handlers de MSW
│
├── public/
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
└── README.md
```

### Regla de oro de feature isolation

Cada `features/<feature>/` contiene:

```
features/places/
├── components/                       # PlaceCard, PlaceGallery, PlaceFilters
├── hooks/                            # usePlaces, usePlaceById, usePlaceSearch
├── store/                            # placesStore.ts (Zustand)
├── api.ts                            # wrappers tipados sobre el cliente OpenAPI
├── types.ts                          # Tipos derivados del cliente
├── utils.ts
├── index.ts                          # Public API: solo exporta lo que otras features pueden usar
└── __tests__/
    ├── usePlaces.test.tsx
    ├── PlaceCard.test.tsx
    └── places.api.test.ts
```

**Reglas estrictas:**
1. Si feature A necesita algo de feature B, lo importa **solo** desde `features/B/index.ts`. Nunca un archivo interno.
2. Una feature **no** puede importar otra feature dentro de sus componentes core (solo hooks/types puntuales). Si algo es realmente compartido, se sube a `shared/`.
3. Los stores Zustand son por feature. No hay un store global excepto auth/sesión.
4. Cada feature documenta su public API en su `index.ts` con comentarios JSDoc.

---

## 4. Design System (Rappi-Style Minimalista)

### Tokens base

```css
:root {
  /* Color: base neutra + accent fuerte */
  --color-bg: #FFFFFF;
  --color-bg-subtle: #F7F8FA;
  --color-surface: #FFFFFF;
  --color-border: #E8EAEE;
  --color-text: #0F1419;
  --color-text-muted: #6B7280;
  --color-text-soft: #9AA0A6;

  /* Accent: rojo coral tipo Rappi pero más Caribe */
  --color-accent: #FF3B5C;          /* Primario — rojo Xitty */
  --color-accent-hover: #E63350;
  --color-accent-soft: #FFE5EA;

  /* Tropical accent secundario para cards turísticas */
  --color-secondary: #0BC4A8;       /* Verde turquesa Caribe */
  --color-warning: #F4B400;
  --color-success: #16A34A;
  --color-error: #DC2626;

  /* Spacing: escala 4px */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px;
  --space-8: 32px; --space-10: 40px; --space-12: 48px;

  /* Radii: generosas, estilo Rappi */
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 24px; --radius-pill: 999px;

  /* Type scale */
  --font-display: 'Inter', system-ui, sans-serif;
  --text-xs: 12px; --text-sm: 14px; --text-base: 16px;
  --text-lg: 18px; --text-xl: 20px; --text-2xl: 24px;
  --text-3xl: 30px; --text-display: 40px;

  /* Sombras: sutiles */
  --shadow-card: 0 2px 8px rgba(15, 20, 25, 0.06);
  --shadow-elevated: 0 12px 24px rgba(15, 20, 25, 0.10);
  --shadow-sheet: 0 -8px 24px rgba(15, 20, 25, 0.08);
}

[data-theme='dark'] {
  --color-bg: #0F1419;
  --color-bg-subtle: #161B22;
  --color-surface: #1A1F26;
  --color-border: #2A3038;
  --color-text: #F5F6F7;
  --color-text-muted: #9AA0A6;
  --color-accent-soft: #2E1A20;
}
```

### Componentes core (shared/ui)

Lista mínima a construir antes de cualquier feature:

| Componente | Patrón Rappi/Spotify | Notas |
|------------|----------------------|-------|
| `Button` | Pill grande, rojo solid o ghost | Variants: primary / secondary / ghost / danger; sizes: sm/md/lg/icon |
| `Card` | Card con foto dominante arriba, contenido abajo | Variants: place / experience / promo / horizontal-scroll |
| `Sheet` | Bottom sheet con drag handle | Para filtros, detalles rápidos, formularios |
| `Modal` / `Dialog` | Centered en desktop, fullscreen en mobile | Confirmaciones, forms |
| `Input` / `Textarea` | Bordes sutiles, focus con accent | Soporta error y helper text |
| `SearchBar` | Pill con icono, full width prominente | Como el de Rappi home |
| `Chip` | Pill pequeña, scroll horizontal | Categorías, tags, filtros activos |
| `Avatar` | Circular con fallback de iniciales | |
| `Badge` | Pill mini para estados (Nuevo, Patrocinado, Reservado) | |
| `Rating` | 5 estrellas + numérico + count | Compacto y display |
| `BottomNav` | 4-5 tabs con icono + label | Tabs por rol |
| `Header` | Sticky con saludo + ubicación + bell | Como Rappi home header |
| `Skeleton` | Para loading states con shimmer | |
| `EmptyState` | Ilustración + texto + CTA | Cuando no hay datos |
| `Tabs` | Underline animation tipo Spotify | |
| `Toast` / `Sonner` | Esquina, no bloqueante | |
| `Drawer` | Lateral en desktop, side menu mobile | Para filtros largos |
| `PriceTag` | Componente especial con formato COP | `$80.000` |
| `DateChipPicker` | Selector horizontal de fechas | Para slots de experiencias |
| `PhotoGallery` | Hero swipeable + thumbnails | Para detalle de place/experience |

### Patrones de UX a respetar

1. **Bottom navigation siempre visible en mobile** (turista). 4 tabs: `Descubrir`, `Buscar`, `Reservas`, `Cuenta`. Para business: `Mi negocio`, `Promos`, `Métricas`, `Cuenta`. Para admin: `Patrocinios`, `Destacados`, `Locales`, `Cuenta`.
2. **Header tipo Rappi en home**: saludo con nombre + ubicación clickeable + icono bell. Background blanco, sticky.
3. **Search bar prominente**: ocupa el ancho completo bajo el header en home.
4. **Carruseles horizontales**: cada sección de la home (Top de la ciudad, Destacados, Experiencias cerca, Disfruta como local) es un carrusel scrolleable horizontalmente con cards de 70-80% de ancho de viewport.
5. **Foto sobre todo**: cada card de lugar/experiencia muestra la foto cover ocupando ≥50% del card.
6. **Sheets bottom-up** para acciones secundarias (filtros, detalle quick-view, formulario de cancelación, login).
7. **Skeleton loaders en lugar de spinners** durante el primer fetch.
8. **Optimistic updates** para favoritos (corazón llena al instante, rebota si falla).
9. **Pull-to-refresh** en feeds principales.
10. **Animaciones suaves** entre rutas con Framer Motion (slide-up para detalles, fade para tabs).
11. **Haptic feedback** simulado con micro-animaciones (scale 0.95 al tap en CTAs).
12. **Mensajes de error en español neutro**, sin tecnicismos.
13. **Empty states con personalidad**: ilustración + frase + CTA ("Aún no has guardado lugares — Explora Barranquilla").
14. **Modo oscuro** soportado desde el día 1.

---

## 5. Estrategia de Estado

### Zustand (estado de cliente / sesión)

Stores por feature, **nunca** un mega-store global. Excepción: `authStore` global porque la sesión la lee todo el árbol.

```typescript
// features/auth/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Role = 'user' | 'business' | 'admin';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; email: string; role: Role; full_name: string | null } | null;
  setSession: (s: Partial<AuthState>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (s) => set((state) => ({ ...state, ...s })),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'xitty-auth' }
  )
);
```

Otros stores Zustand por feature solo si son **estado puramente cliente** (UI):
- `uiStore` global mini: filtros activos en directorio, search query actual, dark mode toggle
- `cartStore` (futuro, si agregamos carrito de experiencias múltiples)

### TanStack Query (estado servidor)

**Todo lo que viene del backend va con Query**, nunca a mano en useEffect. Patrones:

```typescript
// features/places/hooks/usePlaces.ts
export function usePlaces(filters: PlaceListQuery) {
  return useQuery({
    queryKey: ['places', filters],
    queryFn: () => placesApi.findAll(filters),
    staleTime: 5 * 60_000,
  });
}

// Mutaciones con invalidación
export function useCreateReview(placeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateReviewDto) => reviewsApi.create(placeId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['places', placeId, 'reviews'] });
      qc.invalidateQueries({ queryKey: ['places', placeId] });
    },
  });
}
```

Reglas:
- Query keys jerárquicos: `['places', filters]`, `['places', id]`, `['places', id, 'reviews']`.
- `staleTime` agresivo (5min) para listados que no cambian seguido.
- `staleTime: 0` para "Mis reservas" (frescos siempre).
- Optimistic updates para favoritos y review-toggle.
- Prefetch en server components (Next.js App Router) para hidratar query cache.

---

## 6. Capa API (cliente generado)

1. **Generar cliente** desde el Swagger del backend (`/api/docs/-json`):
   ```bash
   npx openapi-typescript-codegen --input http://localhost:3001/api/docs-json --output src/lib/api --client fetch
   ```
2. **Wrap por feature**: `features/<feature>/api.ts` re-exporta los métodos relevantes con tipos curados (no exponer el cliente raw a los componentes).
3. **Interceptor de auth**: incluir `Authorization: Bearer <token>` automáticamente desde `authStore`.
4. **Refresh token automático**: si una llamada da 401, hacer `POST /auth/refresh` con el refresh token y reintentar una vez.
5. **Errores tipados**: parsear `{ statusCode, message }` del backend Nest a un tipo `ApiError` consistente.

```typescript
// lib/api/http.ts (interceptor wrapper)
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    // try refresh, retry once, else logout
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? 'Error');
  }
  return res.json();
}
```

---

## 7. Mapeo de Módulos Backend → Frontend

Los 13 módulos del backend mapean a 16 features del frontend (algunos se separan por UX).

| # | Feature | Endpoints backend | Pantallas |
|---|---------|-------------------|-----------|
| 1 | **auth** | `/auth/*` (9) | Login, Register, Forgot password, Verify email |
| 2 | **onboarding** | `/preferences/*` (4) | Wizard de 3 pasos post-registro |
| 3 | **discover** | combina ranking + featured + local-picks + experiences | Home con carruseles |
| 4 | **places** | `/places/*` + `/categories` (8) | Directorio, búsqueda, detalle, OG |
| 5 | **reviews** | `/places/:id/reviews/*` (4) | Lista de reseñas, formulario, edición |
| 6 | **favorites** | `/places/:id/favorite`, `/favorites` (2) | Lista de favoritos, toggle inline |
| 7 | **microsites** | `/microsites/:slug` (1) | Página pública con CTAs |
| 8 | **promotions** | `/promotions/*` + `/places/:id/promotions/*` (5) | Feed de promos + CRUD para business |
| 9 | **metrics** | `/places/:id/interactions`, `/metrics/*` (3) | Dashboard con gráficas |
| 10 | **notification-settings** | `/me/notification-settings` (2) | Toggle de notificaciones |
| 11 | **ranking** | `/ranking/*` + `/admin/ranking/*` (5) | Sección "Top en Barranquilla" + admin sponsorship |
| 12 | **featured** | `/featured/*` + `/admin/featured/*` (5) | Sección "Destacados" + admin curation |
| 13 | **experiences** | `/experiences/*` + slots + reviews (12) | Catálogo, detalle, gallery, reviews |
| 14 | **reservations** | `/me/reservations`, `/reservations/:id`, `/experiences/:id/reservations` (3) | "Mis reservas" + booking flow |
| 15 | **local-picks** | `/local-picks/*` + `/admin/local-picks/*` (5) | Sección "Disfruta como local" + admin |
| 16 | **admin** | combinación de endpoints `/admin/*` (~8) | Panel completo |

Total: ~76 pantallas/vistas, alimentadas por los 66 endpoints del backend.

---

## 8. Routing y Navegación

### Rutas públicas (sin login)
- `/` — Home discover (anónimo o logueado, contenido cambia)
- `/places` — Directorio con filtros
- `/places/:id` — Detalle del lugar
- `/microsites/:slug` — Micrositio público (URL bonita)
- `/experiences` — Catálogo de experiencias
- `/experiences/:id` — Detalle de experiencia
- `/local-picks` — Sección "Disfruta como local"
- `/login`, `/register`, `/forgot-password`

### Rutas turista (auth)
- `/favorites` — Mis favoritos
- `/reservations` — Mis reservas
- `/profile` — Mi perfil
- `/onboarding` — Wizard inicial

### Rutas business (auth + role=business)
- `/dashboard` — Resumen del negocio
- `/dashboard/places/:id/edit` — Editar mi lugar
- `/dashboard/promotions` — CRUD de promos
- `/dashboard/metrics` — Dashboard con gráficas
- `/dashboard/experiences` — CRUD de experiencias (si es operator)
- `/dashboard/settings` — Notificaciones

### Rutas admin (auth + role=admin)
- `/admin/sponsorships` — Activar/desactivar patrocinios
- `/admin/featured` — Curar destacados semanales
- `/admin/local-picks` — Curar local picks
- `/admin/users` — Lista de usuarios
- `/admin/ranking` — Forzar refresh

### Layouts compartidos
- `(public)/layout.tsx` — Header simple + footer
- `(tourist)/layout.tsx` — Header + BottomNav turista
- `(business)/layout.tsx` — Sidebar + Header business
- `(admin)/layout.tsx` — Sidebar admin

---

## 9. Auth, Roles y Guards

### Auth flow
1. `POST /auth/login` → recibe `{ accessToken, refreshToken, user }`
2. Guarda en `authStore` (persist en localStorage)
3. Interceptor inyecta el token en cada request
4. Si llega 401 → intentar refresh con `refreshToken` → si falla, hacer logout y redirigir a `/login`

### Guards en App Router
Usar middleware Next.js (`src/middleware.ts`) para chequear cookies/headers de sesión y redirigir a `/login` si la ruta lo requiere. Validación adicional en server components (RSC) que leen la sesión.

```typescript
// src/middleware.ts
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/profile', '/reservations', '/favorites'],
};

export function middleware(req: NextRequest) {
  const token = req.cookies.get('xitty-token');
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  // role-based redirect si va a /admin sin role admin (validamos en componente)
}
```

### Roles
Cada layout chequea el rol y muestra/oculta tabs. Si el rol no corresponde, redirige a la home.

---

## 10. Plan de Implementación por Fases

Cada fase termina con tests verdes y deploy de preview funcional.

### Fase 0 — Foundation (1-2 días)

- [ ] Inicializar Next.js 14 + TypeScript estricto
- [ ] Configurar Tailwind, tokens CSS, Inter font, dark mode
- [ ] Configurar ESLint + Prettier + Husky + lint-staged
- [ ] Configurar Vitest + Testing Library + MSW + Playwright
- [ ] Instalar y setupear: Zustand, TanStack Query, React Hook Form, Zod, Framer Motion, shadcn/ui, Lucide
- [ ] Generar cliente API desde el OpenAPI del backend
- [ ] Crear `lib/api/http.ts` con interceptor de auth
- [ ] Construir 50% del design system: Button, Card, Input, Sheet, BottomNav, Header, SearchBar, Chip, Skeleton, EmptyState, Toast
- [ ] Configurar layouts root con providers (QueryClient, ThemeProvider, Toaster)
- [ ] Estructura de carpetas vacía pero ordenada
- [ ] CI básico en Vercel (preview por PR)

**Definition of done:** `npm test`, `npm run build` y `npm run e2e` corren verde con un test trivial.

### Fase 1 — Auth + Onboarding (2-3 días)

- [ ] Feature `auth`: api wrappers, store, hooks (`useLogin`, `useRegister`, `useMe`, `useLogout`)
- [ ] Pantallas: Login, Register, Forgot password, Verify email
- [ ] Interceptor de refresh token funcionando
- [ ] Middleware de Next.js para rutas protegidas
- [ ] Feature `onboarding`: wizard de 3 pasos (datos básicos → preferencias → permisos de ubicación)
- [ ] Tests: cada hook, formularios con validación, E2E del happy path login → home

### Fase 2 — Discover Home (3-4 días)

- [ ] Feature `discover`: agrega data de ranking + featured + local-picks + experiences en la home
- [ ] Header tipo Rappi (saludo + ubicación + bell)
- [ ] SearchBar prominente que dispara `/search`
- [ ] Chips horizontales de categorías (`GET /categories`)
- [ ] Carrusel "Top en Barranquilla" (`GET /ranking?limit=10`)
- [ ] Carrusel "Destacados de la semana" (`GET /featured/current`)
- [ ] Carrusel "Disfruta como local" (`GET /local-picks/current`)
- [ ] Carrusel "Experiencias para ti" (`GET /experiences?sort_by=rating`)
- [ ] Skeleton loaders por sección
- [ ] Pull-to-refresh
- [ ] Tests: cada carrusel, mock de API con MSW, E2E "abro home y veo 5 secciones"

### Fase 3 — Places: Directorio + Detalle + Reviews + Favoritos (4-5 días)

- [ ] Feature `places`: directorio con filtros (categoría, precio, distancia)
- [ ] Búsqueda full-text con debounce (`GET /places/search`)
- [ ] Detalle de lugar con galería swipeable, info, mapa, CTAs (Llamar, WhatsApp, Cómo llegar)
- [ ] Tracking automático de `profile_view` al abrir el detalle
- [ ] Feature `reviews`: lista paginada, ordenable por reciente/mejor, formulario con rating tap, edición/borrado
- [ ] Feature `favorites`: corazón inline en cards con optimistic update, página `/favorites`
- [ ] Filtros en sheet bottom-up
- [ ] Tests por hook, componente Card, E2E del flujo "busco → veo detalle → guardo favorito → reviso favoritos"

### Fase 4 — Microsite Público (1-2 días)

- [ ] Feature `microsites`: ruta `/microsites/:slug` con SSR
- [ ] Open Graph metadata para compartir en redes
- [ ] CTAs grandes con tracking de cada click (`POST /places/:id/interactions`)
- [ ] Promos activas en el mismo perfil
- [ ] Tests: SSR rendering, OG tags presentes, click handlers disparan tracking

### Fase 5 — Experiencias + Booking (4-5 días)

- [ ] Feature `experiences`: catálogo con filtros (tipo, precio, duración, disponibilidad)
- [ ] Detalle de experiencia con galería, descripción, punto de encuentro en mapa
- [ ] DateChipPicker horizontal de slots disponibles (`GET /experiences/:id/slots`)
- [ ] Booking flow: pick slot → step participants → resumen con precio total → confirm
- [ ] Feature `reservations`: pantalla "Mis reservas" con tabs (Próximas, Pasadas, Canceladas)
- [ ] Cancelación desde detalle de reserva con validación de ventana
- [ ] Sección de reviews por experiencia con histograma de estrellas
- [ ] Subida de fotos a Supabase Storage en review form
- [ ] Tests: cada paso del booking, E2E "abro experiencia → reservo → veo en mis reservas → cancelo"

### Fase 6 — Business Dashboard (3-4 días)

- [ ] Feature `metrics`: dashboard con totales + gráficas (Recharts) + comparativa
- [ ] Feature `promotions` (lado business): CRUD con form en modal
- [ ] Edición de place del business (subir foto, editar info, CTAs)
- [ ] Feature `notification-settings`: toggles
- [ ] CRUD de experiencias (si el business es operator)
- [ ] Sidebar lateral en desktop, BottomNav adaptada en mobile
- [ ] Tests: cada CRUD, gráficas con datos mockeados, E2E "creo promo → aparece en lista global"

### Fase 7 — Admin Panel (2-3 días)

- [ ] Feature `admin`: tabs Patrocinios, Destacados, Local picks, Usuarios, Ranking
- [ ] Activar/desactivar sponsorship con duración (días)
- [ ] CRUD de featured semanal
- [ ] CRUD de local picks
- [ ] Lista de usuarios con búsqueda
- [ ] Botón "Forzar refresh ranking"
- [ ] Tests: cada acción admin, validación de role guard

### Fase 8 — Pulido + UX final (2-3 días)

- [ ] Animaciones de transición de rutas con Framer Motion
- [ ] Modo oscuro completo y polished
- [ ] Empty states con ilustraciones (usar undraw.co o ilustraciones propias)
- [ ] Estados de error con retry
- [ ] Performance: lazy load de rutas pesadas, prefetch de imágenes
- [ ] Accessibility audit: contraste, labels, navegación por teclado
- [ ] PWA: manifest + service worker básico (offline cache de home)
- [ ] Internacionalización stub (es-CO por ahora, EN preparado)
- [ ] Lighthouse > 90 en mobile

### Fase 9 — Tests E2E completos + lanzamiento (2 días)

- [ ] Playwright cubriendo los 8 flujos críticos:
  1. Login → Home → ver 5 secciones
  2. Buscar → ver detalle → favorito
  3. Abrir microsite público → click WhatsApp
  4. Crear cuenta business → crear place → crear promo
  5. Crear experiencia → crear slot → reservar como turista
  6. Cancelar reserva dentro de ventana
  7. Admin: activar sponsorship → ver lugar primero en ranking
  8. Admin: crear local pick → aparecer en home
- [ ] Visual regression tests para los 5 componentes core (Card, Button, Sheet, Header, BottomNav)
- [ ] Smoke test post-deploy
- [ ] Documentación de cómo correr y deployar

**Total estimado: ~25-30 días dev solo, ~5 semanas calendario.**

---

## 11. Estrategia de Testing

| Nivel | Herramienta | Cobertura objetivo | Cuándo |
|-------|-------------|--------------------|--------|
| Unitario (hooks, stores, utils) | Vitest | ≥80% en `features/*/hooks` y `features/*/store` | En cada feature |
| Componente | Vitest + Testing Library | Componentes con lógica (Cards, Forms) | En cada feature |
| Integration (feature completa) | Vitest + MSW | 1 test por feature core | En cada feature |
| E2E | Playwright | 8 flujos críticos en mobile + desktop | Fase 9 |
| Visual regression | Playwright screenshots | 5 componentes core | Fase 9 |

### Convención de tests

```typescript
// features/places/hooks/__tests__/usePlaces.test.tsx
describe('usePlaces', () => {
  it('devuelve la lista paginada con cards hidratadas', async () => {
    server.use(
      http.get('/places', () => HttpResponse.json({
        data: [{ id: '1', name: 'Trattoria', cover_photo_url: '...' }],
        total: 1, page: 1, limit: 10, totalPages: 1,
      }))
    );

    const { result } = renderHook(() => usePlaces({ category_id: 'c1' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data[0].name).toBe('Trattoria');
  });

  it('refetch al cambiar el filtro', async () => { /* ... */ });
  it('maneja error 500 sin crashear', async () => { /* ... */ });
});
```

### MSW handlers

`tests/mocks/handlers.ts` — un handler por endpoint backend con respuestas realistas. Reusados en tests y en dev cuando no hay backend.

---

## 12. Performance y UX patterns

- **Imágenes**: `next/image` con `sizes` apropiado, lazy load por defecto, priority en hero.
- **Code splitting**: cada `features/<feature>/` se importa dinámicamente en la ruta cuando aplique.
- **Prefetch**: Next.js prefetch automático en links visibles; añadir prefetch manual de queries en hover de cards principales.
- **Skeleton over spinner**: siempre.
- **Optimistic updates**: favorites, review submit (rollback en error).
- **Infinite scroll**: con `useInfiniteQuery` para listados largos (reservas, reviews, directorio).
- **Debounce 300ms** en search bar.
- **Cache de imágenes**: Service Worker simple para offline-first en home (Fase 8).
- **Métricas Web Vitals**: tracking en `analytics.ts`.

---

## 13. Variables de entorno

`.env.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_GA_ID= # opcional
```

Validar con Zod en `lib/env.ts` para fallar al build si falta algo.

---

## 14. Convenciones de código

- **Naming**: `kebab-case` para archivos (`place-card.tsx`), `PascalCase` para componentes y tipos, `camelCase` para hooks y funciones, `SCREAMING_SNAKE` para constantes.
- **Componentes**: 1 componente por archivo. Nombre del archivo = nombre del componente.
- **No prop drilling profundo**: si un prop pasa de 3 niveles, considera context o store.
- **Pure components**: separar UI tonta (en `components/`) de UI con lógica (en `containers/` o directamente en `app/`).
- **Comentarios**: solo el porqué, no el qué. Si el código es obvio, no comentar.
- **Imports ordenados**: external → shared → feature → relative. Configurar con `eslint-plugin-import`.
- **No `any`**. Si necesitas escape hatch, usar `unknown` y narrow.

---

## 15. Despliegue

- **Vercel** con preview por PR.
- Branch `main` → producción `xitty.co`.
- Branch `staging` → `staging.xitty.co`.
- Variables de entorno por environment.
- Edge runtime para rutas públicas (microsites) y serverless para resto.

---

## 16. Roadmap a futuro (post-MVP)

- Push notifications (web + mobile via FCM)
- Pago integrado en reservas (Stripe)
- AI sugiriendo local picks
- App nativa con Expo (compartiendo el mismo cliente API generado)
- Internacionalización completa (EN, PT)
- Programa de loyalty con puntos
- QR routes (M9 cuando se implemente en backend)
- Itinerarios personalizados con AI (M11 backend)

---

## 17. Cómo arrancar (siguiente paso para el agente)

1. Leer este documento completo.
2. Confirmar con el usuario:
   - Color exacto del accent (default `#FF3B5C` rojo coral, alternativas: turquesa `#0BC4A8`, naranja `#FF7043`)
   - Si quiere `xitty-frontend` como repo separado o monorepo con backend
   - Si arrancamos directo en Fase 0 o quiere preview del design system primero
3. Crear el repo, ejecutar Fase 0.
4. Avanzar fase por fase con PRs separados, siguiendo las convenciones de este doc.
5. Cada PR debe traer: feature completa + tests + screenshot de UI relevante.

---

**Backend status (referencia):**
- 66 endpoints implementados
- 13 módulos NestJS
- 17 tablas Postgres + materialized view + 3 vistas
- 117/117 tests pasando
- Swagger en `/api/docs` cuando el backend está corriendo

Cualquier cambio en el backend debe regenerar el cliente API del frontend (`npm run gen:api`).
