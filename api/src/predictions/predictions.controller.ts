import { Body, Controller, Param, Put, Req } from '@nestjs/common';
import { Prediction } from '@prisma/client';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { UpsertPredictionDto } from './dto/upsert-prediction.dto';
import { PredictionsService } from './predictions.service';

@Controller('matches/:mid/prediction')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Put()
  upsert(
    @Req() req: RequestWithUser,
    @Param('mid') matchId: string,
    @Body() dto: UpsertPredictionDto,
  ): Promise<Prediction> {
    return this.predictionsService.upsertForMatch(req.user!, matchId, dto);
  }
}
