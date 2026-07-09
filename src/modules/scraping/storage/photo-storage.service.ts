import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'scraped-photos';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — descartamos imágenes anómalas

/**
 * Re-hospeda fotos de la fuente (Google Places, etc.) en nuestro bucket.
 *
 * Por qué: las URLs de foto de la fuente llevan/necesitan la API key o expiran.
 * Descargamos server-side (agregando la key SOLO como header, nunca en una URL
 * persistida) y subimos una copia propia a `scraped-photos`, cuya URL pública
 * es estable y no expone secretos.
 *
 * Best-effort: cualquier fallo devuelve null y el pipeline sigue sin imagen.
 */
@Injectable()
export class PhotoStorageService {
  private readonly logger = new Logger(PhotoStorageService.name);
  /** Inyectable para tests (default = fetch nativo de Node >=18). */
  private fetchImpl: typeof fetch = globalThis.fetch;

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async rehost(
    sourceUrl: string | null | undefined,
    keyBase: string,
  ): Promise<string | null> {
    if (!sourceUrl || sourceUrl.trim().length === 0) return null;

    try {
      const headers: Record<string, string> = {};
      // Google Places (New) media: la key va como header, jamás en la URL guardada.
      if (
        sourceUrl.includes('places.googleapis.com') &&
        process.env.GOOGLE_MAPS_API_KEY
      ) {
        headers['X-Goog-Api-Key'] = process.env.GOOGLE_MAPS_API_KEY;
      }

      const resp = await this.fetchImpl(sourceUrl, {
        headers,
        redirect: 'follow',
      });
      if (!resp.ok) {
        this.logger.warn(`rehost ${keyBase}: descarga HTTP ${resp.status}`);
        return null;
      }

      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        this.logger.warn(
          `rehost ${keyBase}: content-type no-imagen (${contentType})`,
        );
        return null;
      }

      const bytes = new Uint8Array(await resp.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
        this.logger.warn(
          `rehost ${keyBase}: tamaño inválido ${bytes.byteLength}`,
        );
        return null;
      }

      const ext = contentType.includes('png')
        ? 'png'
        : contentType.includes('webp')
          ? 'webp'
          : 'jpg';
      const path = `${keyBase}.${ext}`;

      const { error } = await this.supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (error) {
        this.logger.warn(`rehost ${keyBase}: upload falló — ${error.message}`);
        return null;
      }

      const { data } = this.supabase.storage.from(BUCKET).getPublicUrl(path);
      return data?.publicUrl ?? null;
    } catch (err: unknown) {
      this.logger.warn(
        `rehost ${keyBase}: falló (best-effort) — ${errorMessage(err)}`,
      );
      return null;
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown error';
}
