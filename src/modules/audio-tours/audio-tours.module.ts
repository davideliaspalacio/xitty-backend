import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../config/database.module';
import { AudioToursController } from './audio-tours.controller';
import { AudioToursService } from './audio-tours.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AudioToursController],
  providers: [AudioToursService],
  exports: [AudioToursService],
})
export class AudioToursModule {}
