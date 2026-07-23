import { BadRequestException, Logger } from '@nestjs/common';

/**
 * Logger compartido para errores de base de datos. Usamos un contexto fijo para
 * que estos errores sean fáciles de filtrar en los logs del servidor.
 */
const dbLogger = new Logger('DatabaseError');

/**
 * Extrae un mensaje legible de cualquier forma de error (Error, objeto de
 * Supabase con `message`, string, etc.) sin asumir el tipo.
 */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Registra el error CRUDO de la BD/Supabase en el servidor y lanza una
 * excepción con un mensaje GENÉRICO en español (auditoría #3).
 *
 * Antes se hacía `throw new BadRequestException(error.message)`, lo que filtraba
 * detalles internos de Postgres al cliente (nombres de columnas, constraints,
 * etc.). Mantenemos el tipo `BadRequestException` para no cambiar el contrato
 * HTTP (400), pero el detalle solo queda en los logs del servidor.
 *
 * @param error   El error tal cual lo devolvió Supabase/Postgres.
 * @param context Etiqueta corta para ubicar el origen en los logs
 *                (p. ej. 'PlacesService.findAll').
 */
export function throwDbError(error: unknown, context: string): never {
  dbLogger.error(`${context}: ${describe(error)}`);
  throw new BadRequestException(
    'No se pudo procesar la solicitud. Intenta de nuevo en un momento.',
  );
}
