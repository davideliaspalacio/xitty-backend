import {
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';

import { ScraperSource } from '../scraper-source.interface';
import type { ScrapingSource } from '../storage/scraping-sources.repo';
import { EventbriteSource } from './eventbrite-source';
import { TavilySearchSource } from './tavily-search-source';
import {
  GooglePlacesSource,
  GooglePlacesConfig,
  GooglePlacesType,
} from './google-places-source';

/** Centro por defecto para google_places cuando la config no trae lat/lng. */
const BARRANQUILLA = { lat: 10.9685, lng: -74.7813 };
const GOOGLE_PLACES_TYPES: GooglePlacesType[] = [
  'restaurant',
  'tourist_attraction',
  'event_venue',
];

/**
 * Construye la implementacion concreta de `ScraperSource` que corresponde a una
 * fila de `scraping_sources` (creada desde el panel admin) segun su `kind`.
 *
 * Esto es lo que cierra el hueco entre los dos mundos:
 *   - el panel admin guarda sources en la DB con un UUID + kind + config
 *   - el runner necesita un objeto que sepa hacer fetch()
 *
 * El `id` de la source concreta NO importa aca: el executor atribuye el run al
 * UUID de la DB explicitamente. El factory solo necesita devolver algo con un
 * `fetch()` valido.
 *
 * Kinds implementados hoy: `eventbrite`, `tavily`, `google_places`.
 * El resto (`firecrawl`, `manual`) lanza 501 con un mensaje claro en lugar de
 * un 404 enganoso.
 */
@Injectable()
export class ScraperSourceFactory {
  build(source: Pick<ScrapingSource, 'kind' | 'config' | 'name'>): ScraperSource {
    const config = source.config ?? {};

    switch (source.kind) {
      case 'eventbrite':
        return new EventbriteSource(config);

      case 'tavily': {
        const query = typeof config.query === 'string' ? config.query.trim() : '';
        if (!query) {
          throw new BadRequestException(
            `La source "${source.name}" (tavily) requiere "query" en su config`,
          );
        }
        return new TavilySearchSource({ ...config, query, name: source.name });
      }

      case 'google_places': {
        // GooglePlacesSource implementa la interfaz `Source<TConfig>` (fetch toma
        // la config como argumento), no `ScraperSource`. Lo adaptamos a un
        // ScraperSource cuyo fetch() ya tiene la config bindeada.
        const gp = new GooglePlacesSource();
        const type: GooglePlacesType = GOOGLE_PLACES_TYPES.includes(config.type)
          ? config.type
          : 'tourist_attraction';
        const gpConfig: GooglePlacesConfig = {
          lat: typeof config.lat === 'number' ? config.lat : BARRANQUILLA.lat,
          lng: typeof config.lng === 'number' ? config.lng : BARRANQUILLA.lng,
          radius_m:
            typeof config.radius_m === 'number' ? config.radius_m : 5000,
          type,
          max_results:
            typeof config.max_results === 'number' ? config.max_results : 20,
        };
        return {
          id: 'google-places',
          name: source.name,
          enabled: true,
          fetch: () => gp.fetch(gpConfig),
        };
      }

      case 'firecrawl':
      case 'manual':
        throw new NotImplementedException(
          `El kind "${source.kind}" todavia no tiene implementacion de scraping ` +
            `(disponibles: eventbrite, tavily, google_places)`,
        );

      default:
        throw new BadRequestException(
          `Kind de source desconocido: "${source.kind}"`,
        );
    }
  }
}
