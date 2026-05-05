import { Module } from '@nestjs/common';
import { LocalPicksController } from './local-picks.controller';
import { LocalPicksService } from './local-picks.service';
import { DatabaseModule } from '../../config/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [LocalPicksController],
  providers: [LocalPicksService],
  exports: [LocalPicksService],
})
export class LocalPicksModule {}
