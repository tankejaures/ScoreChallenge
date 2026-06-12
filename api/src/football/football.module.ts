import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FootballApiClient } from './football-api.client';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [FootballController],
  providers: [FootballApiClient, FootballService],
  exports: [FootballApiClient, FootballService],
})
export class FootballModule {}
