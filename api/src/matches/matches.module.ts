import { Module } from '@nestjs/common';
import { ScoringService } from '../predictions/scoring.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, ScoringService],
  exports: [MatchesService],
})
export class MatchesModule {}
