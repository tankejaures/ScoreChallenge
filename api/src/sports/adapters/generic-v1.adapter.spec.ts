import { SportsHttpClient } from '../sports-http';
import { ApiV1GameEntry, ApiV1LeagueEntry } from '../sports-api.types';
import { GenericV1Adapter } from './generic-v1.adapter';

describe('GenericV1Adapter', () => {
  let http: { request: jest.Mock; isConfigured: jest.Mock };
  let adapter: GenericV1Adapter;

  beforeEach(() => {
    http = { request: jest.fn(), isConfigured: jest.fn() };
    adapter = new GenericV1Adapter(
      http as unknown as SportsHttpClient,
      'BASKETBALL',
    );
  });

  it('normalizes flat league entries with current season', async () => {
    const entry: ApiV1LeagueEntry = {
      id: 12,
      name: 'NBA',
      type: 'League',
      logo: 'nba.png',
      country: { name: 'USA' },
      seasons: [
        { season: '2024-2025', current: false },
        { season: '2025-2026', current: true },
      ],
    };
    http.request.mockResolvedValue([entry]);
    const competitions = await adapter.getCompetitions();
    expect(http.request).toHaveBeenCalledWith(
      'https://v1.basketball.api-sports.io',
      '/leagues',
    );
    expect(competitions).toEqual([
      {
        sport: 'BASKETBALL',
        leagueId: 12,
        name: 'NBA',
        type: 'League',
        logo: 'nba.png',
        country: 'USA',
        season: '2025-2026',
      },
    ]);
  });

  it('normalizes wrapped league entries ({ league: {...} })', async () => {
    const entry: ApiV1LeagueEntry = {
      league: { id: 1, name: 'NFL', logo: null },
      country: { name: 'USA' },
      seasons: [{ season: 2026, current: true }],
    };
    http.request.mockResolvedValue([entry]);
    const competitions = await adapter.getCompetitions();
    expect(competitions[0].leagueId).toBe(1);
    expect(competitions[0].season).toBe('2026');
  });

  it('skips leagues without a current season', async () => {
    http.request.mockResolvedValue([
      { id: 9, name: 'Old', seasons: [{ season: 2020, current: false }] },
    ]);
    const competitions = await adapter.getCompetitions();
    expect(competitions).toEqual([]);
  });

  it('normalizes games with object scores (total)', async () => {
    const game: ApiV1GameEntry = {
      id: 401,
      date: '2026-06-15T18:00:00+00:00',
      status: { short: 'Q2' },
      league: { id: 12, season: '2025-2026', round: null },
      teams: {
        home: { name: 'Lakers', logo: 'lal.png' },
        away: { name: 'Celtics', logo: 'bos.png' },
      },
      scores: { home: { total: 54 }, away: { total: 49 } },
    };
    http.request.mockResolvedValue([game]);
    const games = await adapter.getGames(12, '2025-2026');
    expect(http.request).toHaveBeenCalledWith(
      'https://v1.basketball.api-sports.io',
      '/games?league=12&season=2025-2026',
    );
    expect(games[0]).toMatchObject({
      externalId: 401,
      season: '2025-2026',
      status: 'LIVE',
      scoreA: 54,
      scoreB: 49,
      minute: null,
    });
  });

  it('normalizes games with plain number scores and game wrapper', async () => {
    const game: ApiV1GameEntry = {
      game: {
        id: 88,
        date: { date: '2026-06-15T18:00:00+00:00' },
        status: { short: 'FT' },
      },
      league: { id: 3, season: 2026 },
      teams: { home: { name: 'A' }, away: { name: 'B' } },
      scores: { home: 27, away: 13 },
    };
    http.request.mockResolvedValue([game]);
    const games = await adapter.getGames(3, '2026');
    expect(games[0]).toMatchObject({
      externalId: 88,
      status: 'FINISHED',
      scoreA: 27,
      scoreB: 13,
    });
    expect(games[0].kickoffAt.toISOString()).toBe('2026-06-15T18:00:00.000Z');
  });

  it('fetches live games grouped by league/season/date and filters by ids', async () => {
    const mkGame = (id: number): ApiV1GameEntry => ({
      id,
      date: '2026-06-15T18:00:00+00:00',
      status: { short: 'Q1' },
      league: { id: 12, season: '2025-2026' },
      teams: { home: { name: 'A' }, away: { name: 'B' } },
      scores: { home: 2, away: 0 },
    });
    http.request.mockResolvedValue([mkGame(401), mkGame(999)]);
    const games = await adapter.getLiveGames([
      {
        externalId: 401,
        leagueId: 12,
        season: '2025-2026',
        kickoffAt: new Date('2026-06-15T18:00:00Z'),
      },
    ]);
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith(
      'https://v1.basketball.api-sports.io',
      '/games?league=12&season=2025-2026&date=2026-06-15',
    );
    expect(games).toHaveLength(1);
    expect(games[0].externalId).toBe(401);
  });
});
