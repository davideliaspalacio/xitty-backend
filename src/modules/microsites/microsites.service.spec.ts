import { NotFoundException } from '@nestjs/common';
import { MicrositesService } from './microsites.service';

/**
 * El modulo microsites no tenia spec — por eso nadie noto que nunca devolvia
 * `cover_photo_url` y el preview al compartir salia sin imagen.
 */
function makeSupabase({
  place = { id: 'p1', name: 'La Cueva', slug: 'la-cueva' } as any,
  photos = [] as any[],
  promos = [] as any[],
} = {}) {
  const placeChain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: place, error: null }),
  };
  const photosChain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: photos, error: null }),
  };
  const promosChain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: promos, error: null }),
  };
  const from = jest.fn((table: string) => {
    if (table === 'places') return placeChain;
    if (table === 'place_photos') return photosChain;
    return promosChain;
  });
  return { from } as any;
}

describe('MicrositesService.findBySlug', () => {
  it('deriva cover_photo_url de la foto marcada is_cover', async () => {
    const svc = new MicrositesService(
      makeSupabase({
        photos: [
          { url: 'https://cdn/1.jpg', is_cover: false },
          { url: 'https://cdn/cover.jpg', is_cover: true },
        ],
      }),
    );

    const res: any = await svc.findBySlug('la-cueva');

    expect(res.cover_photo_url).toBe('https://cdn/cover.jpg');
    expect(res.photos).toHaveLength(2);
  });

  it('cae a la primera foto si ninguna esta marcada como cover', async () => {
    const svc = new MicrositesService(
      makeSupabase({
        photos: [
          { url: 'https://cdn/primera.jpg', is_cover: false },
          { url: 'https://cdn/otra.jpg', is_cover: false },
        ],
      }),
    );

    const res: any = await svc.findBySlug('la-cueva');

    expect(res.cover_photo_url).toBe('https://cdn/primera.jpg');
  });

  it('cover_photo_url = null cuando el lugar no tiene fotos', async () => {
    const svc = new MicrositesService(makeSupabase({ photos: [] }));
    const res: any = await svc.findBySlug('la-cueva');
    expect(res.cover_photo_url).toBeNull();
  });

  it('devuelve las promos activas junto al micrositio', async () => {
    const svc = new MicrositesService(
      makeSupabase({ promos: [{ id: 'promo-1', title: '2x1' }] }),
    );
    const res: any = await svc.findBySlug('la-cueva');
    expect(res.active_promotions).toEqual([{ id: 'promo-1', title: '2x1' }]);
  });

  it('tira NotFound si el slug no existe', async () => {
    const svc = new MicrositesService(makeSupabase({ place: null }));
    await expect(svc.findBySlug('no-existe')).rejects.toThrow(NotFoundException);
  });
});
