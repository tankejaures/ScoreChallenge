import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface RankingRow {
  id: string;
  name: string;
  totalPoints: number;
  matchesPlayed: number;
  correctPredictions: number;
  exactScores: number;
  correctOutcomes: number;
}

export interface RankingEntry extends RankingRow {
  rank: number;
  successRate: number;
  averagePoints: number;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRanking(groupId: string): Promise<RankingEntry[]> {
    const rows = await this.prisma.$queryRaw<RankingRow[]>`
      SELECT p.id,
             p.name,
             COALESCE(SUM(pr.points), 0)::int                                   AS "totalPoints",
             COUNT(pr.id)::int                                                  AS "matchesPlayed",
             COUNT(pr.id) FILTER (WHERE pr.points > 0)::int                     AS "correctPredictions",
             COUNT(pr.id) FILTER (WHERE pr.points = g."scoringExactScore")::int AS "exactScores",
             COUNT(pr.id) FILTER (WHERE pr.points = g."scoringCorrectOutcome")::int AS "correctOutcomes"
      FROM "Participant" p
      JOIN "Group" g ON g.id = p."groupId"
      LEFT JOIN "Prediction" pr ON pr."participantId" = p.id AND pr.points IS NOT NULL
      WHERE p."groupId" = ${groupId}
      GROUP BY p.id, p.name, g."scoringExactScore", g."scoringCorrectOutcome"
      ORDER BY "totalPoints" DESC, "exactScores" DESC, p.name ASC
    `;
    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      successRate: row.matchesPlayed
        ? Math.round((row.correctPredictions / row.matchesPlayed) * 100)
        : 0,
      averagePoints: row.matchesPlayed
        ? Math.round((row.totalPoints / row.matchesPlayed) * 100) / 100
        : 0,
    }));
  }

  async getParticipantStats(
    groupId: string,
    participantId: string,
  ): Promise<RankingEntry> {
    const ranking = await this.getRanking(groupId);
    const entry = ranking.find((r) => r.id === participantId);
    if (!entry) {
      throw new NotFoundException('Participant introuvable');
    }
    return entry;
  }

  async getGroupStats(groupId: string) {
    const ranking = await this.getRanking(groupId);
    const matchCount = await this.prisma.match.count({ where: { groupId } });
    const participantCount = ranking.length;
    const totalPoints = ranking.reduce((sum, r) => sum + r.totalPoints, 0);
    const mostExact =
      [...ranking].sort((a, b) => b.exactScores - a.exactScores)[0] ?? null;
    return {
      participantCount,
      matchCount,
      averagePointsPerPlayer: participantCount
        ? Math.round((totalPoints / participantCount) * 100) / 100
        : 0,
      bestPlayer: ranking[0] ?? null,
      mostExactScores: mostExact,
      ranking,
    };
  }
}
