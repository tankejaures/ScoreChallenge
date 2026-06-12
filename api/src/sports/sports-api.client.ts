import { Injectable } from '@nestjs/common';
import { Sport } from '@prisma/client';
import { FootballAdapter } from './adapters/football.adapter';
import { GenericV1Adapter } from './adapters/generic-v1.adapter';
import {
  SportApiAdapter,
  WatchedFixtureRef,
} from './adapters/sport-adapter.interface';
import { SPORT_CONFIG } from './sport.config';
import { CompetitionDto, NormalizedGame } from './sports-api.types';
import { SportsHttpClient } from './sports-http';

const COMPETITIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GAMES_CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class SportsApiClient {
  private readonly adapters: Record<Sport, SportApiAdapter>;
  private readonly competitionsCache = new Map<
    Sport,
    CacheEntry<CompetitionDto[]>
  >();
  private readonly gamesCache = new Map<string, CacheEntry<NormalizedGame[]>>();

  constructor(private readonly http: SportsHttpClient) {
    this.adapters = Object.fromEntries(
      Object.entries(SPORT_CONFIG).map(([sport, config]) => [
        sport,
        config.api === 'v3-football'
          ? new FootballAdapter(http)
          : new GenericV1Adapter(http, sport as Sport),
      ]),
    ) as unknown as Record<Sport, SportApiAdapter>;
  }

  isConfigured(): boolean {
    return this.http.isConfigured();
  }

  async getCompetitions(sport: Sport): Promise<CompetitionDto[]> {
    const cached = this.competitionsCache.get(sport);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const competitions = await this.adapters[sport].getCompetitions();
    this.competitionsCache.set(sport, {
      value: competitions,
      expiresAt: Date.now() + COMPETITIONS_CACHE_TTL_MS,
    });
    return competitions;
  }

  async getGames(
    sport: Sport,
    leagueId: number,
    season: string,
  ): Promise<NormalizedGame[]> {
    const cacheKey = `${sport}:${leagueId}:${season}`;
    const cached = this.gamesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const games = await this.adapters[sport].getGames(leagueId, season);
    this.gamesCache.set(cacheKey, {
      value: games,
      expiresAt: Date.now() + GAMES_CACHE_TTL_MS,
    });
    return games;
  }

  // Pas de cache : état live.
  getLiveGames(
    sport: Sport,
    refs: WatchedFixtureRef[],
  ): Promise<NormalizedGame[]> {
    return this.adapters[sport].getLiveGames(refs);
  }
}
