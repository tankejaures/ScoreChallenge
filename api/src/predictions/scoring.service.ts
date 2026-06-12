import { Injectable } from '@nestjs/common';

export interface Score {
  a: number;
  b: number;
}

export interface ScoringConfig {
  exactScore: number;
  correctOutcome: number;
  oneTeamScore: number;
}

@Injectable()
export class ScoringService {
  computePoints(
    prediction: Score,
    result: Score,
    config: ScoringConfig,
  ): number {
    if (prediction.a === result.a && prediction.b === result.b) {
      return config.exactScore;
    }
    if (
      Math.sign(prediction.a - prediction.b) === Math.sign(result.a - result.b)
    ) {
      return config.correctOutcome;
    }
    if (prediction.a === result.a || prediction.b === result.b) {
      return config.oneTeamScore;
    }
    return 0;
  }
}
