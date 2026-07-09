import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  createSupabaseClient,
  createSupabaseAuthClient,
} from './supabase.config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'SUPABASE_CLIENT',
      useFactory: (configService: ConfigService) =>
        createSupabaseClient(configService),
      inject: [ConfigService],
    },
    {
      provide: 'SUPABASE_AUTH_CLIENT',
      useFactory: (configService: ConfigService) =>
        createSupabaseAuthClient(configService),
      inject: [ConfigService],
    },
  ],
  exports: ['SUPABASE_CLIENT', 'SUPABASE_AUTH_CLIENT'],
})
export class DatabaseModule {}
