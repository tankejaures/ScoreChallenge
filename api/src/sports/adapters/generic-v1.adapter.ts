import { Sport } from '@prisma/client';
import { mapV1Status } from '../fixture-status.util';
import { SPORT_CONFIG } from '../sport.config';
import {
  ApiV1GameEntry,
  ApiV1LeagueEntry,
  ApiV1Score,
  CompetitionDto,
  NormalizedGame,
} from '../sports-api.types';
import { SportsHttpClient } from '../sports-http';
import { SportApiAdapter, WatchedFixtureRef } from './sport-adapter.interface';

function scoreToNumber(score: ApiV1Score): number | null {
  if (typeof score === 'number') {
    return score;
  }
  if (score && typeof score.total === 'number') {
    return score.total;
  }
  return null;
}

function gameDate(entry: ApiV1GameEntry): Date {
  const raw = entry.game?.date ?? entry.date;
  const iso = typeof raw === 'string' ? raw : (raw?.date ?? '');
  return new Date(iso);
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class GenericV1Adapter implements SportApiAdapter {
  constructor(
    private readonly http: SportsHttpClient,
    private readonly sport: Sport,
  ) {}

  private get baseUrl(): string {
    return SPORT_CONFIG[this.sport].baseUrl;
  }

  async getCompetitions(): Promise<CompetitionDto[]> {
    const entries = await this.http.request<ApiV1LeagueEntry>(
      this.baseUrl,
      '/leagues',
    );
    return entries
      .map((entry) => this.toCompetition(entry))
      .filter((c): c is CompetitionDto => c !== null);
  }

  async getGames(leagueId: number, season: string): Promise<NormalizedGame[]> {
    const entries = await this.http.request<ApiV1GameEntry>(
      this.baseUrl,
      `/games?league=${leagueId}&season=${encodeURIComponent(season)}`,
    );
    return entries.map((entry) => this.toNormalizedGame(entry));
  }

  // Pas de batch par ids en v1 : une requête par (ligue, saison, jour UTC),
  // puis filtrage sur les externalIds demandés.
  async getLiveGames(refs: WatchedFixtureRef[]): Promise<NormalizedGame[]> {
    const wanted = new Set(refs.map((r) => r.externalId));
    const groups = new Map<string, WatchedFixtureRef>();
    for (const ref of refs) {
      groups.set(`${ref.leagueId}:${ref.season}:${utcDay(ref.kickoffAt)}`, ref);
    }
    const results: NormalizedGame[] = [];
    for (const ref of groups.values()) {
      const entries = await this.http.request<ApiV1GameEntry>(
        this.baseUrl,
        `/games?league=${ref.leagueId}&season=${encodeURIComponent(ref.season)}&date=${utcDay(ref.kickoffAt)}`,
      );
      for (const entry of entries) {
        const game = this.toNormalizedGame(entry);
        if (wanted.has(game.externalId)) {
          results.push(game);
        }
      }
    }
    return results;
  }

  private toCompetition(entry: ApiV1LeagueEntry): CompetitionDto | null {
    const league = entry.league ?? entry;
    const current = entry.seasons?.find((s) => s.current);
    if (!league.id || !league.name || !current) {
      return null;
    }
    return {
      sport: this.sport,
      leagueId: league.id,
      name: league.name,
      type: league.type ?? 'League',
      logo: league.logo ?? null,
      country: entry.country?.name ?? '',
      season: String(current.season),
    };
  }

  private toNormalizedGame(entry: ApiV1GameEntry): NormalizedGame {
    const core = entry.game ?? entry;
    return {
      externalId: core.id ?? 0,
      leagueId: entry.league.id,
      season: String(entry.league.season),
      round: entry.league.round ?? null,
      teamA: entry.teams.home.name,
      teamB: entry.teams.away.name,
      teamALogo: entry.teams.home.logo ?? null,
      teamBLogo: entry.teams.away.logo ?? null,
      kickoffAt: gameDate(entry),
      status: mapV1Status(core.status?.short ?? 'NS'),
      minute: null,
      scoreA: scoreToNumber(entry.scores.home),
      scoreB: scoreToNumber(entry.scores.away),
    };
  }
}
