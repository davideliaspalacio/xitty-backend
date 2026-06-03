import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const readCredentials = (configService: ConfigService) => {
  const supabaseUrl = configService.get<string>('SUPABASE_URL');
  const supabaseKey = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

  // Debug logs (safe - no sensitive data)
  console.log('🔍 Debug - SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing');
  console.log('🔍 Debug - SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Present' : 'Missing');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'OK' : 'MISSING');
    throw new Error('Supabase URL and Service Role Key must be provided');
  }

  return { supabaseUrl, supabaseKey };
};

// Como backend stateless, ningún cliente debe persistir sesión ni refrescar
// tokens en segundo plano.
const STATELESS_AUTH = {
  persistSession: false,
  autoRefreshToken: false,
} as const;

/**
 * Cliente de DATOS (service role). NUNCA debe ejecutar operaciones de auth
 * (signIn/signUp/verifyOtp): hacerlo reemplazaría el token de service_role por
 * el del usuario logueado y las queries `.from(...)` quedarían sujetas a RLS.
 * Todas las consultas a tablas del backend pasan por este cliente.
 */
export const createSupabaseClient = (configService: ConfigService): SupabaseClient => {
  const { supabaseUrl, supabaseKey } = readCredentials(configService);

  return createClient(supabaseUrl, supabaseKey, { auth: STATELESS_AUTH });
};

/**
 * Cliente EXCLUSIVO para operaciones de auth (signIn/signUp/verifyOtp/recovery).
 * Es una instancia separada para evitar el "session tainting" de supabase-js:
 * aquí sí se setea la sesión del usuario, pero como nunca se usa para `.from(...)`
 * el cliente de datos conserva siempre las credenciales de service_role.
 */
export const createSupabaseAuthClient = (configService: ConfigService): SupabaseClient => {
  const { supabaseUrl, supabaseKey } = readCredentials(configService);

  return createClient(supabaseUrl, supabaseKey, { auth: STATELESS_AUTH });
};
