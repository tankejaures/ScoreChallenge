import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Fixture, Sport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SportsApiClient } from './sports-api.client';
import { CompetitionDto, NormalizedGame } from './sports-api.types';

@Injectable()
export class SportsService {
  constructor(
    private readonly client: SportsApiClient,
    private readonly prisma: PrismaService,
  ) {}

  getCompetitions(sport: Sport): Promise<CompetitionDto[]> {
    this.assertConfigured();
    return this.client.getCompetitions(sport);
  }

  async listFixtures(
    sport: Sport,
    leagueId: number,
    season: string,
  ): Promise<Fixture[]> {
    this.assertConfigured();
    const games = await this.client.getGames(sport, leagueId, season);
    return Promise.all(games.map((game) => this.upsertGame(sport, game)));
  }

  upsertGame(sport: Sport, game: NormalizedGame): Promise<Fixture> {
    const data = {
      leagueId: game.leagueId,
      season: game.season,
      round: game.round,
      teamA: game.teamA,
      teamB: game.teamB,
      teamALogo: game.teamALogo,
      teamBLogo: game.teamBLogo,
      kickoffAt: game.kickoffAt,
      status: game.status,
      minute: game.minute,
      scoreA: game.scoreA,
      scoreB: game.scoreB,
    };
    return this.prisma.fixture.upsert({
      where: { sport_externalId: { sport, externalId: game.externalId } },
      create: { sport, externalId: game.externalId, ...data },
      update: data,
    });
  }

  private assertConfigured(): void {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException(
        'API sports non configurée (SPORTS_API_KEY manquante)',
      );
    }
  }
}
