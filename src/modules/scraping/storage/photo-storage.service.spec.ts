import type { SupabaseClient } from '@supabase/supabase-js';

import { PhotoStorageService } from './photo-storage.service';

interface UploadResult {
  error: { message: string } | null;
}

interface PublicUrlResult {
  data: {
    publicUrl: string;
  };
}

interface UploadOptions {
  contentType: string;
  upsert: boolean;
}

type UploadMock = jest.MockedFunction<
  (
    path: string,
    body: Uint8Array,
    options: UploadOptions,
  ) => Promise<UploadResult>
>;
type GetPublicUrlMock = jest.MockedFunction<(path: string) => PublicUrlResult>;

interface StorageBucketMock {
  upload: UploadMock;
  getPublicUrl: GetPublicUrlMock;
}

type FromMock = jest.MockedFunction<(bucket: string) => StorageBucketMock>;
type FetchMock = jest.MockedFunction<typeof fetch>;

interface SupabaseFixture {
  supabase: SupabaseClient;
  upload: UploadMock;
  getPublicUrl: GetPublicUrlMock;
  from: FromMock;
}

function makeSupabase(
  uploadResult: UploadResult = { error: null },
  publicUrl = 'https://cdn.example/scraped-photos/x.jpg',
): SupabaseFixture {
  const upload = jest
    .fn<
      (
        path: string,
        body: Uint8Array,
        options: UploadOptions,
      ) => Promise<UploadResult>
    >()
    .mockResolvedValue(uploadResult);
  const getPublicUrl = jest
    .fn<(path: string) => PublicUrlResult>()
    .mockReturnValue({ data: { publicUrl } });
  const bucket: StorageBucketMock = { upload, getPublicUrl };
  const from = jest
    .fn<(bucket: string) => StorageBucketMock>()
    .mockReturnValue(bucket);
  return {
    supabase: { storage: { from } } as unknown as SupabaseClient,
    upload,
    getPublicUrl,
    from,
  };
}

function makeResp(
  opts: {
    ok?: boolean;
    status?: number;
    contentType?: string;
    bytes?: Uint8Array;
  } = {},
) {
  const { ok = true, status, contentType = 'image/jpeg' } = opts;
  const responseStatus = status ?? (ok ? 200 : 500);
  return new Response(opts.bytes ?? new Uint8Array([1, 2, 3, 4]), {
    status: responseStatus,
    headers: { 'content-type': contentType },
  });
}

function setFetchImpl(
  service: PhotoStorageService,
  fetchImpl: typeof fetch,
): void {
  Object.defineProperty(service, 'fetchImpl', {
    value: fetchImpl,
    writable: true,
  });
}

function fetchInitOfCall(mock: FetchMock, callIdx = 0): RequestInit {
  const init = mock.mock.calls[callIdx]?.[1];
  if (!init) {
    throw new Error(`fetch call ${callIdx} did not include init options`);
  }
  return init;
}

function headerValue(init: RequestInit, name: string): string | null {
  const headers = init.headers;
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    return (
      headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ??
      null
    );
  }
  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}

describe('PhotoStorageService', () => {
  it('devuelve null si sourceUrl es null o vacío', async () => {
    const { supabase } = makeSupabase();
    const svc = new PhotoStorageService(supabase);
    expect(await svc.rehost(null, 'k')).toBeNull();
    expect(await svc.rehost('', 'k')).toBeNull();
  });

  it('descarga, sube al bucket y devuelve la URL pública', async () => {
    const { supabase, upload, from } = makeSupabase();
    const svc = new PhotoStorageService(supabase);
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue(makeResp());
    setFetchImpl(svc, fetchImpl);

    const url = await svc.rehost(
      'https://img.example/x.jpg',
      'google-places/abc',
    );

    expect(url).toBe('https://cdn.example/scraped-photos/x.jpg');
    expect(from).toHaveBeenCalledWith('scraped-photos');
    expect(upload).toHaveBeenCalledWith(
      'google-places/abc.jpg',
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    );
  });

  it('agrega la key de Google como header (nunca en la URL) para places.googleapis.com', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const { supabase } = makeSupabase();
    const svc = new PhotoStorageService(supabase);
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue(makeResp());
    setFetchImpl(svc, fetchImpl);

    await svc.rehost(
      'https://places.googleapis.com/v1/places/x/photos/y/media',
      'k',
    );

    const opts = fetchInitOfCall(fetchImpl);
    expect(headerValue(opts, 'X-Goog-Api-Key')).toBe('test-key');
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it('best-effort: devuelve null si la descarga no es 2xx', async () => {
    const { supabase } = makeSupabase();
    const svc = new PhotoStorageService(supabase);
    setFetchImpl(
      svc,
      jest
        .fn<typeof fetch>()
        .mockResolvedValue(makeResp({ ok: false, status: 404 })),
    );
    expect(await svc.rehost('https://img.example/x.jpg', 'k')).toBeNull();
  });

  it('devuelve null si el content-type no es imagen', async () => {
    const { supabase } = makeSupabase();
    const svc = new PhotoStorageService(supabase);
    setFetchImpl(
      svc,
      jest
        .fn<typeof fetch>()
        .mockResolvedValue(makeResp({ contentType: 'text/html' })),
    );
    expect(await svc.rehost('https://img.example/x.jpg', 'k')).toBeNull();
  });

  it('no tira si el upload falla (devuelve null)', async () => {
    const { supabase } = makeSupabase({ error: { message: 'boom' } });
    const svc = new PhotoStorageService(supabase);
    setFetchImpl(svc, jest.fn<typeof fetch>().mockResolvedValue(makeResp()));
    expect(await svc.rehost('https://img.example/x.jpg', 'k')).toBeNull();
  });
});
