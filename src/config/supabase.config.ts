import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const createSupabaseClient = (configService: ConfigService): SupabaseClient => {
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

  return createClient(supabaseUrl, supabaseKey);
};
