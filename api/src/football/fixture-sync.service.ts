import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchSettlementService } from '../matches/match-settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { FootballApiClient } from './football-api.client';
import { FootballService } from './football.service';
import { mapFixtureStatus } from './fixture-status.util';

const WATCH_BEFORE_KICKOFF_MS = 5 * 60 * 1000;
const WATCH_AFTER_KICKOFF_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class FixtureSyncService {
  private readonly logger = new Logger(FixtureSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: FootballApiClient,
    private readonly footballService: FootballService,
    private readonly settlementService: MatchSettlementService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sync(): Promise<void> {
    if (!this.client.isConfigured()) {
      return;
    }
    const now = Date.now();
    const watched = await this.prisma.fixture.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        kickoffAt: {
          gte: new Date(now - WATCH_AFTER_KICKOFF_MS),
          lte: new Date(now + WATCH_BEFORE_KICKOFF_MS),
        },
        matches: { some: {} },
      },
    });
    if (watched.length === 0) {
      return;
    }
    try {
      const entries = await this.client.getFixturesByIds(
        watched.map((f) => f.externalId),
      );
      for (const entry of entries) {
        const previous = watched.find(
          (f) => f.externalId === entry.fixture.id,
        );
        if (!previous) {
          continue;
        }
        const updated = await this.footballService.upsertFixture(entry);
        const justFinished =
          previous.status !== 'FINISHED' &&
          mapFixtureStatus(entry.fixture.status.short) === 'FINISHED';
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
        `Synchronisation API-Football échouée : ${(error as Error).message}`,
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
