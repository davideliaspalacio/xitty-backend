import { localize, getLang, SupportedLang, DEFAULT_LANG } from '../localize';

describe('i18n / localize', () => {
  describe('localize()', () => {
    it('returns record unchanged when there are no translations', () => {
      const record = {
        id: 'p1',
        name: 'La Trattoria',
        description: 'Italiana clasica',
      };

      const result = localize(record, 'en');
      expect(result).toEqual(record);
    });

    it('overrides name and description when translations[lang] exists', () => {
      const record = {
        id: 'p1',
        name: 'La Trattoria',
        description: 'Italiana clasica',
        translations: {
          en: { name: 'The Trattoria', description: 'Classic Italian' },
        },
      };

      const result = localize(record, 'en');
      expect(result.name).toBe('The Trattoria');
      expect(result.description).toBe('Classic Italian');
      // Original record is not mutated
      expect(record.name).toBe('La Trattoria');
    });

    it('only overrides fields present in translations entry', () => {
      const record = {
        id: 'p1',
        name: 'La Trattoria',
        description: 'Italiana clasica',
        translations: {
          en: { name: 'The Trattoria' },
        },
      };

      const result = localize(record, 'en');
      expect(result.name).toBe('The Trattoria');
      // description preserved from base record
      expect(result.description).toBe('Italiana clasica');
    });

    it('leaves record unchanged when lang is "es" (base language)', () => {
      const record = {
        id: 'p1',
        name: 'La Trattoria',
        description: 'Italiana clasica',
        translations: {
          en: { name: 'The Trattoria', description: 'Classic Italian' },
        },
      };

      const result = localize(record, 'es');
      expect(result.name).toBe('La Trattoria');
      expect(result.description).toBe('Italiana clasica');
    });

    it('leaves record unchanged when translations key for lang is missing', () => {
      const record = {
        id: 'p1',
        name: 'La Trattoria',
        description: 'Italiana clasica',
        translations: {
          en: { name: 'The Trattoria' },
        },
      };

      const result = localize(record, 'fr');
      expect(result.name).toBe('La Trattoria');
      expect(result.description).toBe('Italiana clasica');
    });

    it('handles experience records that use "title" alongside name/description', () => {
      const record = {
        id: 'e1',
        title: 'Tour del Centro',
        description: 'Recorrido historico',
        translations: {
          en: { title: 'Downtown Tour', description: 'Historic walk' },
        },
      };

      const result = localize(record, 'en');
      expect(result.title).toBe('Downtown Tour');
      expect(result.description).toBe('Historic walk');
    });

    it('returns record unchanged when lang is null/undefined', () => {
      const record = {
        id: 'p1',
        name: 'La Trattoria',
        description: 'Italiana clasica',
        translations: {
          en: { name: 'The Trattoria' },
        },
      };

      expect(localize(record, undefined).name).toBe('La Trattoria');
      expect(localize(record, null as any).name).toBe('La Trattoria');
    });
  });

  describe('getLang()', () => {
    it('returns lang from query.lang when present and supported', () => {
      const req: any = { query: { lang: 'en' }, headers: {} };
      expect(getLang(req)).toBe('en');
    });

    it('returns lang from Accept-Language header when query missing', () => {
      const req: any = {
        query: {},
        headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' },
      };
      expect(getLang(req)).toBe('fr');
    });

    it('prefers query.lang over Accept-Language header', () => {
      const req: any = {
        query: { lang: 'pt' },
        headers: { 'accept-language': 'en-US,en;q=0.9' },
      };
      expect(getLang(req)).toBe('pt');
    });

    it('defaults to "es" when neither query nor header provided', () => {
      const req: any = { query: {}, headers: {} };
      expect(getLang(req)).toBe(DEFAULT_LANG);
      expect(getLang(req)).toBe('es');
    });

    it('defaults to "es" when lang is not in the supported set', () => {
      const req: any = { query: { lang: 'xx' }, headers: {} };
      expect(getLang(req)).toBe('es');
    });

    it('lowercases and trims the lang value', () => {
      const req: any = { query: { lang: ' EN ' }, headers: {} };
      expect(getLang(req)).toBe('en');
    });

    it('accepts all four supported langs: es, en, fr, pt', () => {
      const langs: SupportedLang[] = ['es', 'en', 'fr', 'pt'];
      for (const l of langs) {
        const req: any = { query: { lang: l }, headers: {} };
        expect(getLang(req)).toBe(l);
      }
    });

    it('handles missing query object on req', () => {
      const req: any = { headers: { 'accept-language': 'en' } };
      expect(getLang(req)).toBe('en');
    });

    it('handles missing headers object on req', () => {
      const req: any = { query: { lang: 'fr' } };
      expect(getLang(req)).toBe('fr');
    });
  });
});
