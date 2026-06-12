import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Fixture, Sport } from '@prisma/client';
import { MatchSettlementService } from '../matches/match-settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { SPORT_CONFIG } from './sport.config';
import { SportsApiClient } from './sports-api.client';
import { SportsService } from './sports.service';

const WATCH_BEFORE_KICKOFF_MS = 5 * 60 * 1000;
const MAX_WATCH_AFTER_KICKOFF_MS = Math.max(
  ...Object.values(SPORT_CONFIG).map((c) => c.watchAfterKickoffMs),
);

@Injectable()
export class FixtureSyncService {
  private readonly logger = new Logger(FixtureSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SportsApiClient,
    private readonly sportsService: SportsService,
    private readonly settlementService: MatchSettlementService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sync(): Promise<void> {
    if (!this.client.isConfigured()) {
      return;
    }
    const now = Date.now();
    const candidates = await this.prisma.fixture.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        kickoffAt: {
          gte: new Date(now - MAX_WATCH_AFTER_KICKOFF_MS),
          lte: new Date(now + WATCH_BEFORE_KICKOFF_MS),
        },
        matches: { some: {} },
      },
    });
    // Fenêtre précise par sport
    const watched = candidates.filter(
      (f) =>
        f.kickoffAt.getTime() >= now - SPORT_CONFIG[f.sport].watchAfterKickoffMs,
    );
    if (watched.length === 0) {
      return;
    }
    const bySport = new Map<Sport, Fixture[]>();
    for (const fixture of watched) {
      bySport.set(fixture.sport, [
        ...(bySport.get(fixture.sport) ?? []),
        fixture,
      ]);
    }
    for (const [sport, fixtures] of bySport) {
      await this.syncSport(sport, fixtures);
    }
  }

  private async syncSport(sport: Sport, fixtures: Fixture[]): Promise<void> {
    try {
      const games = await this.client.getLiveGames(
        sport,
        fixtures.map((f) => ({
          externalId: f.externalId,
          leagueId: f.leagueId,
          season: f.season,
          kickoffAt: f.kickoffAt,
        })),
      );
      for (const game of games) {
        const previous = fixtures.find(
          (f) => f.externalId === game.externalId,
        );
        if (!previous) {
          continue;
        }
        const updated = await this.sportsService.upsertGame(sport, game);
        const justFinished =
          previous.status !== 'FINISHED' && game.status === 'FINISHED';
        if (
          justFinished &&
          updated.scoreA !== null &&
          updated.scoreB !== null
        ) {
          await this.settleLinkedMatches(
            updated.id,
            updated.scoreA,
            updated.scoreB,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Synchronisation ${sport} échouée : ${(error as Error).message}`,
      );
    }
  }

  private async settleLinkedMatches(
    fixtureId: string,
    scoreA: number,
    scoreB: number,
  ): Promise<void> {
    const matches = await this.prisma.match.findMany({
      where: { fixtureId, finalScoreA: null },
      select: { id: true },
    });
    for (const match of matches) {
      await this.settlementService.settle(match.id, scoreA, scoreB);
    }
    if (matches.length > 0) {
      this.logger.log(
        `Fixture ${fixtureId} terminée : ${matches.length} match(s) réglé(s) automatiquement`,
      );
    }
  }
}
