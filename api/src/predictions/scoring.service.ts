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
    const aMatch = prediction.a === result.a && result.a > 0;
    const bMatch = prediction.b === result.b && result.b > 0;
    if (aMatch || bMatch) {
      return config.oneTeamScore;
    }
    if (
      Math.sign(prediction.a - prediction.b) === Math.sign(result.a - result.b)
    ) {
      return config.correctOutcome;
    }
    return 0;
  }
}
