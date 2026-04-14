import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createSupabaseClient } from './supabase.config';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'SUPABASE_CLIENT',
      useFactory: (configService: ConfigService) => createSupabaseClient(configService),
      inject: [ConfigService],
    },
  ],
  exports: ['SUPABASE_CLIENT'],
})
export class DatabaseModule {}
