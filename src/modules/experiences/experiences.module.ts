import { Module } from '@nestjs/common';
import { ExperiencesController } from './experiences.controller';
import { ExperiencesService } from './experiences.service';
import { ReservationsService } from './reservations.service';
import { ExperienceReviewsService } from './experience-reviews.service';
import { DatabaseModule } from '../../config/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService, ReservationsService, ExperienceReviewsService],
  exports: [ExperiencesService, ReservationsService, ExperienceReviewsService],
})
export class ExperiencesModule {}
