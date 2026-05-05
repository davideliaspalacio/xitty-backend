import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { PlacesModule } from './modules/places/places.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { MicrositesModule } from './modules/microsites/microsites.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { NotificationSettingsModule } from './modules/notification-settings/notification-settings.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { FeaturedModule } from './modules/featured/featured.module';
import { ExperiencesModule } from './modules/experiences/experiences.module';
import { LocalPicksModule } from './modules/local-picks/local-picks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    PreferencesModule,
    PlacesModule,
    ReviewsModule,
    FavoritesModule,
    MicrositesModule,
    PromotionsModule,
    MetricsModule,
    NotificationSettingsModule,
    RankingModule,
    FeaturedModule,
    ExperiencesModule,
    LocalPicksModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
