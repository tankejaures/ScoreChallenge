import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiFixtureEntry,
  ApiFootballEnvelope,
  ApiLeagueEntry,
  CompetitionDto,
} from './football-api.types';

const COMPETITIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FIXTURES_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_IDS_PER_REQUEST = 20;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class FootballApiClient {
  private competitionsCache: CacheEntry<CompetitionDto[]> | null = null;
  private readonly fixturesCache = new Map<
    string,
    CacheEntry<ApiFixtureEntry[]>
  >();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('FOOTBALL_API_KEY'));
  }

  async getCurrentCompetitions(): Promise<CompetitionDto[]> {
    if (
      this.competitionsCache &&
      this.competitionsCache.expiresAt > Date.now()
    ) {
      return this.competitionsCache.value;
    }
    const entries = await this.request<ApiLeagueEntry>('/leagues?current=true');
    const competitions = entries
      .map((entry) => {
        const currentSeason = entry.seasons.find((s) => s.current);
        if (!currentSeason) {
          return null;
        }
        return {
          leagueId: entry.league.id,
          name: entry.league.name,
          type: entry.league.type,
          logo: entry.league.logo,
          country: entry.country.name,
          season: currentSeason.year,
        };
      })
      .filter((c): c is CompetitionDto => c !== null);
    this.competitionsCache = {
      value: competitions,
      expiresAt: Date.now() + COMPETITIONS_CACHE_TTL_MS,
    };
    return competitions;
  }

  async getFixtures(
    leagueId: number,
    season: number,
  ): Promise<ApiFixtureEntry[]> {
    const cacheKey = `${leagueId}:${season}`;
    const cached = this.fixturesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const fixtures = await this.request<ApiFixtureEntry>(
      `/fixtures?league=${leagueId}&season=${season}`,
    );
    this.fixturesCache.set(cacheKey, {
      value: fixtures,
      expiresAt: Date.now() + FIXTURES_CACHE_TTL_MS,
    });
    return fixtures;
  }

  // Pas de cache : appelé par le cron pour l'état live.
  async getFixturesByIds(externalIds: number[]): Promise<ApiFixtureEntry[]> {
    const results: ApiFixtureEntry[] = [];
    for (let i = 0; i < externalIds.length; i += MAX_IDS_PER_REQUEST) {
      const chunk = externalIds.slice(i, i + MAX_IDS_PER_REQUEST);
      results.push(
        ...(await this.request<ApiFixtureEntry>(
          `/fixtures?ids=${chunk.join('-')}`,
        )),
      );
    }
    return results;
  }

  private async request<T>(path: string): Promise<T[]> {
    const baseUrl = this.config.get<string>('FOOTBALL_API_URL');
    const apiKey = this.config.get<string>('FOOTBALL_API_KEY');
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-apisports-key': apiKey ?? '' },
    });
    if (!response.ok) {
      throw new Error(`API-Football error ${response.status}`);
    }
    const body = (await response.json()) as ApiFootballEnvelope<T>;
    return body.response;
  }
}
