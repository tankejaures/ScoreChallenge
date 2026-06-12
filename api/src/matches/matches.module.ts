import { Module } from '@nestjs/common';
import { PredictionsModule } from '../predictions/predictions.module';
import { MatchSettlementService } from './match-settlement.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [PredictionsModule],
  controllers: [MatchesController],
  providers: [MatchesService, MatchSettlementService],
  exports: [MatchesService, MatchSettlementService],
})
export class MatchesModule {}
