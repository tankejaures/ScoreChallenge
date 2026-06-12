import { SportsHttpClient } from '../sports-http';
import { ApiFixtureEntry, ApiLeagueEntry } from '../sports-api.types';
import { FootballAdapter } from './football.adapter';

const leagueEntry: ApiLeagueEntry = {
  league: { id: 1, name: 'World Cup', type: 'Cup', logo: 'wc.png' },
  country: { name: 'World' },
  seasons: [
    { year: 2026, current: true, start: '2026-06-11', end: '2026-07-19' },
  ],
};

const fixtureEntry: ApiFixtureEntry = {
  fixture: {
    id: 101,
    date: '2026-06-15T16:00:00+00:00',
    status: { short: '1H', elapsed: 23 },
  },
  league: { id: 1, season: 2026, round: 'Group A - 1' },
  teams: {
    home: { name: 'France', logo: 'fr.png' },
    away: { name: 'Brésil', logo: 'br.png' },
  },
  goals: { home: 1, away: 0 },
};

describe('FootballAdapter', () => {
  let http: { request: jest.Mock };
  let adapter: FootballAdapter;

  beforeEach(() => {
    http = { request: jest.fn() };
    adapter = new FootballAdapter(http as unknown as SportsHttpClient);
  });

  it('normalizes current competitions', async () => {
    http.request.mockResolvedValue([leagueEntry]);
    const competitions = await adapter.getCompetitions();
    expect(http.request).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io',
      '/leagues?current=true',
    );
    expect(competitions[0]).toMatchObject({
      sport: 'FOOTBALL',
      leagueId: 1,
      season: '2026',
    });
  });

  it('normalizes fixtures with live minute', async () => {
    http.request.mockResolvedValue([fixtureEntry]);
    const games = await adapter.getGames(1, '2026');
    expect(http.request).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io',
      '/fixtures?league=1&season=2026',
    );
    expect(games[0]).toMatchObject({
      externalId: 101,
      status: 'LIVE',
      minute: 23,
      scoreA: 1,
      season: '2026',
    });
  });

  it('chunks live requests by 20 ids', async () => {
    http.request.mockResolvedValue([]);
    const refs = Array.from({ length: 25 }, (_, i) => ({
      externalId: i + 1,
      leagueId: 1,
      season: '2026',
      kickoffAt: new Date(),
    }));
    await adapter.getLiveGames(refs);
    expect(http.request).toHaveBeenCalledTimes(2);
    expect(http.request).toHaveBeenNthCalledWith(
      1,
      'https://v3.football.api-sports.io',
      `/fixtures?ids=${refs
        .slice(0, 20)
        .map((r) => r.externalId)
        .join('-')}`,
    );
  });
});
