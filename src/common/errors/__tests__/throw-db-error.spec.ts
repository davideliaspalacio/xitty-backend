import { BadRequestException, Logger } from '@nestjs/common';
import { throwDbError } from '../throw-db-error';

describe('throwDbError', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lanza BadRequestException con un mensaje genérico (sin filtrar el detalle)', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    expect(() =>
      throwDbError(
        { message: 'duplicate key value violates unique constraint "x"' },
        'FooService',
      ),
    ).toThrow(BadRequestException);

    try {
      throwDbError({ message: 'internal postgres detail' }, 'FooService');
    } catch (e) {
      const err = e as BadRequestException;
      expect(err).toBeInstanceOf(BadRequestException);
      // El mensaje al cliente NO debe contener el detalle interno.
      expect(err.message).not.toContain('postgres');
      expect(err.message).toContain('No se pudo procesar la solicitud');
    }
  });

  it('registra el detalle CRUDO en el logger del servidor con su contexto', () => {
    const spy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    expect(() =>
      throwDbError({ message: 'db down' }, 'BarService.method'),
    ).toThrow(BadRequestException);

    expect(spy).toHaveBeenCalledWith('BarService.method: db down');
  });

  it('maneja errores que son instancias de Error y strings', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    expect(() => throwDbError(new Error('boom'), 'Ctx')).toThrow(
      BadRequestException,
    );
    expect(() => throwDbError('plain string error', 'Ctx')).toThrow(
      BadRequestException,
    );
  });
});
