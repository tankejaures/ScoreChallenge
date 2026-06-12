import { Injectable, NotFoundException } from '@nestjs/common';
import { Match } from '@prisma/client';
import { ScoringService } from '../predictions/scoring.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
  ) {}

  // Enregistre le score final d'un match et recalcule les points
  // de tous les pronostics associés, dans une transaction.
  async settle(
    matchId: string,
    scoreA: number,
    scoreB: number,
  ): Promise<Match> {
    const existing = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { group: true },
    });
    if (!existing) {
      throw new NotFoundException('Match introuvable');
    }
    const config = {
      exactScore: existing.group.scoringExactScore,
      correctOutcome: existing.group.scoringCorrectOutcome,
      oneTeamScore: existing.group.scoringOneTeamScore,
    };
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.match.update({
        where: { id: matchId },
        data: { finalScoreA: scoreA, finalScoreB: scoreB },
      });
      const predictions = await tx.prediction.findMany({ where: { matchId } });
      for (const prediction of predictions) {
        const points = this.scoringService.computePoints(
          { a: prediction.scoreA, b: prediction.scoreB },
          { a: scoreA, b: scoreB },
          config,
        );
        await tx.prediction.update({
          where: { id: prediction.id },
          data: { points },
        });
      }
      return match;
    });
  }
}
