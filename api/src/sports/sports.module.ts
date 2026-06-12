import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchesModule } from '../matches/matches.module';
import { FixtureSyncService } from './fixture-sync.service';
import { SportsApiClient } from './sports-api.client';
import { SportsController } from './sports.controller';
import { SportsHttpClient } from './sports-http';
import { SportsService } from './sports.service';

@Module({
  imports: [ScheduleModule.forRoot(), MatchesModule],
  controllers: [SportsController],
  providers: [
    SportsHttpClient,
    SportsApiClient,
    SportsService,
    FixtureSyncService,
  ],
  exports: [SportsApiClient, SportsService],
})
export class SportsModule {}
