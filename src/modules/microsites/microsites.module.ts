import { Module } from '@nestjs/common';
import { MicrositesController } from './microsites.controller';
import { MicrositesService } from './microsites.service';
import { DatabaseModule } from '../../config/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MicrositesController],
  providers: [MicrositesService],
  exports: [MicrositesService],
})
export class MicrositesModule {}
