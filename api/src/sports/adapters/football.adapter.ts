import { mapFixtureStatus } from '../fixture-status.util';
import { SPORT_CONFIG } from '../sport.config';
import {
  ApiFixtureEntry,
  ApiLeagueEntry,
  CompetitionDto,
  NormalizedGame,
} from '../sports-api.types';
import { SportsHttpClient } from '../sports-http';
import { SportApiAdapter, WatchedFixtureRef } from './sport-adapter.interface';

const MAX_IDS_PER_REQUEST = 20;

export class FootballAdapter implements SportApiAdapter {
  constructor(private readonly http: SportsHttpClient) {}

  private get baseUrl(): string {
    return SPORT_CONFIG.FOOTBALL.baseUrl;
  }

  async getCompetitions(): Promise<CompetitionDto[]> {
    const entries = await this.http.request<ApiLeagueEntry>(
      this.baseUrl,
      '/leagues?current=true',
    );
    return entries
      .map((entry) => {
        const currentSeason = entry.seasons.find((s) => s.current);
        if (!currentSeason) {
          return null;
        }
        return {
          sport: 'FOOTBALL' as const,
          leagueId: entry.league.id,
          name: entry.league.name,
          type: entry.league.type,
          logo: entry.league.logo,
          country: entry.country.name,
          season: String(currentSeason.year),
        };
      })
      .filter((c): c is CompetitionDto => c !== null);
  }

  async getGames(leagueId: number, season: string): Promise<NormalizedGame[]> {
    const entries = await this.http.request<ApiFixtureEntry>(
      this.baseUrl,
      `/fixtures?league=${leagueId}&season=${encodeURIComponent(season)}`,
    );
    return entries.map((entry) => this.toNormalizedGame(entry));
  }

  async getLiveGames(refs: WatchedFixtureRef[]): Promise<NormalizedGame[]> {
    const ids = refs.map((r) => r.externalId);
    const results: NormalizedGame[] = [];
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
      const chunk = ids.slice(i, i + MAX_IDS_PER_REQUEST);
      const entries = await this.http.request<ApiFixtureEntry>(
        this.baseUrl,
        `/fixtures?ids=${chunk.join('-')}`,
      );
      results.push(...entries.map((entry) => this.toNormalizedGame(entry)));
    }
    return results;
  }

  private toNormalizedGame(entry: ApiFixtureEntry): NormalizedGame {
    return {
      externalId: entry.fixture.id,
      leagueId: entry.league.id,
      season: String(entry.league.season),
      round: entry.league.round ?? null,
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
  }
}
