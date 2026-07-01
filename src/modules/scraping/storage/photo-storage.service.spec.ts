import { PhotoStorageService } from './photo-storage.service';

function makeSupabase(
  uploadResult: { error: { message: string } | null } = { error: null },
  publicUrl = 'https://cdn.example/scraped-photos/x.jpg',
) {
  const upload = jest.fn().mockResolvedValue(uploadResult);
  const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl } });
  const from = jest.fn().mockReturnValue({ upload, getPublicUrl });
  return {
    supabase: { storage: { from } } as any,
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
  const {
    ok = true,
    status = 200,
    contentType = 'image/jpeg',
    bytes = new Uint8Array([1, 2, 3, 4]),
  } = opts;
  return {
    ok,
    status,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'content-type' ? contentType : null,
    },
    arrayBuffer: async () => bytes.buffer,
  } as any;
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
    const fetchImpl = jest.fn().mockResolvedValue(makeResp());
    (svc as any).fetchImpl = fetchImpl;

    const url = await svc.rehost('https://img.example/x.jpg', 'google-places/abc');

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
    const fetchImpl = jest.fn().mockResolvedValue(makeResp());
    (svc as any).fetchImpl = fetchImpl;

    await svc.rehost(
      'https://places.googleapis.com/v1/places/x/photos/y/media',
      'k',
    );

    const opts = fetchImpl.mock.calls[0][1];
    expect(opts.headers['X-Goog-Api-Key']).toBe('test-key');
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it('best-effort: devuelve null si la descarga no es 2xx', async () => {
    const { supabase } = makeSupabase();
    const svc = new PhotoStorageService(supabase);
    (svc as any).fetchImpl = jest
      .fn()
      .mockResolvedValue(makeResp({ ok: false, status: 404 }));
    expect(await svc.rehost('https://img.example/x.jpg', 'k')).toBeNull();
  });

  it('devuelve null si el content-type no es imagen', async () => {
    const { supabase } = makeSupabase();
    const svc = new PhotoStorageService(supabase);
    (svc as any).fetchImpl = jest
      .fn()
      .mockResolvedValue(makeResp({ contentType: 'text/html' }));
    expect(await svc.rehost('https://img.example/x.jpg', 'k')).toBeNull();
  });

  it('no tira si el upload falla (devuelve null)', async () => {
    const { supabase } = makeSupabase({ error: { message: 'boom' } });
    const svc = new PhotoStorageService(supabase);
    (svc as any).fetchImpl = jest.fn().mockResolvedValue(makeResp());
    expect(await svc.rehost('https://img.example/x.jpg', 'k')).toBeNull();
  });
});
