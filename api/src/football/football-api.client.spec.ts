import { ConfigService } from '@nestjs/config';
import { FootballApiClient } from './football-api.client';
import { ApiLeagueEntry } from './football-api.types';

const leagueEntry: ApiLeagueEntry = {
  league: { id: 1, name: 'World Cup', type: 'Cup', logo: 'wc.png' },
  country: { name: 'World' },
  seasons: [
    { year: 2026, current: true, start: '2026-06-11', end: '2026-07-19' },
  ],
};

describe('FootballApiClient', () => {
  let client: FootballApiClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: [leagueEntry] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const config = {
      get: (key: string) =>
        key === 'FOOTBALL_API_KEY' ? 'test-key' : 'https://api.test',
    } as ConfigService;
    client = new FootballApiClient(config);
  });

  it('fetches current competitions with the API key header', async () => {
    const competitions = await client.getCurrentCompetitions();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/leagues?current=true',
      { headers: { 'x-apisports-key': 'test-key' } },
    );
    expect(competitions).toEqual([
      {
        leagueId: 1,
        name: 'World Cup',
        type: 'Cup',
        logo: 'wc.png',
        country: 'World',
        season: 2026,
      },
    ]);
  });

  it('caches competitions for subsequent calls', async () => {
    await client.getCurrentCompetitions();
    await client.getCurrentCompetitions();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the API responds with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 });
    await expect(client.getCurrentCompetitions()).rejects.toThrow(
      'API-Football error 429',
    );
  });

  it('chunks live fixture requests by 20 ids', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: [] }),
    });
    const ids = Array.from({ length: 25 }, (_, i) => i + 1);
    await client.getFixturesByIds(ids);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `https://api.test/fixtures?ids=${ids.slice(0, 20).join('-')}`,
      { headers: { 'x-apisports-key': 'test-key' } },
    );
  });
});
