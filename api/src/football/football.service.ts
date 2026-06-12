import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Fixture } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FootballApiClient } from './football-api.client';
import { ApiFixtureEntry, CompetitionDto } from './football-api.types';
import { mapFixtureStatus } from './fixture-status.util';

@Injectable()
export class FootballService {
  constructor(
    private readonly client: FootballApiClient,
    private readonly prisma: PrismaService,
  ) {}

  getCompetitions(): Promise<CompetitionDto[]> {
    this.assertConfigured();
    return this.client.getCurrentCompetitions();
  }

  async listFixtures(leagueId: number, season: number): Promise<Fixture[]> {
    this.assertConfigured();
    const entries = await this.client.getFixtures(leagueId, season);
    return Promise.all(entries.map((entry) => this.upsertFixture(entry)));
  }

  upsertFixture(entry: ApiFixtureEntry): Promise<Fixture> {
    const data = {
      leagueId: entry.league.id,
      season: entry.league.season,
      round: entry.league.round,
      teamA: entry.teams.home.name,
      teamB: entry.teams.away.name,
      teamALogo: entry.teams.home.logo,
      teamBLogo: entry.teams.away.logo,
      kickoffAt: new Date(entry.fixture.date),
      status: mapFixtureStatus(entry.fixture.status.short),
      minute: entry.fixture.status.elapsed,
      scoreA: entry.goals.home,
      scoreB: entry.goals.away,
    };
    return this.prisma.fixture.upsert({
      where: { externalId: entry.fixture.id },
      create: { externalId: entry.fixture.id, ...data },
      update: data,
    });
  }

  private assertConfigured(): void {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException(
        'API football non configurée (FOOTBALL_API_KEY manquante)',
      );
    }
  }
}
