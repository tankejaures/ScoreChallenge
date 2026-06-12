import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { Competition, FixtureView } from '../core/models';
import { SportsStore } from './sports.store';

const nba: Competition = {
  sport: 'BASKETBALL',
  leagueId: 12,
  name: 'NBA',
  type: 'League',
  logo: 'nba.png',
  country: 'USA',
  season: '2025-2026',
};

const fixture = (id: string, round: string): FixtureView => ({
  id,
  externalId: 1,
  sport: 'BASKETBALL',
  leagueId: 12,
  season: '2025-2026',
  round,
  teamA: 'Lakers',
  teamB: 'Celtics',
  teamALogo: null,
  teamBLogo: null,
  kickoffAt: new Date().toISOString(),
  status: 'SCHEDULED',
  minute: null,
  scoreA: null,
  scoreB: null,
});

describe('SportsStore', () => {
  const api = {
    sportCompetitions: vi.fn(),
    competitionFixtures: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api as unknown as ApiService }],
    });
  });

  it('loads competitions for a sport', async () => {
    api.sportCompetitions.mockReturnValue(of([nba]));
    const store = TestBed.inject(SportsStore);
    await store.loadCompetitions('BASKETBALL');
    expect(api.sportCompetitions).toHaveBeenCalledWith('BASKETBALL');
    expect(store.competitions()).toEqual([nba]);
    expect(store.loading()).toBe(false);
  });

  it('loads fixtures for a competition', async () => {
    api.competitionFixtures.mockReturnValue(of([fixture('f1', 'Round 1')]));
    const store = TestBed.inject(SportsStore);
    await store.loadFixtures('BASKETBALL', 12, '2025-2026');
    expect(api.competitionFixtures).toHaveBeenCalledWith('BASKETBALL', 12, '2025-2026');
    expect(store.fixtures().length).toBe(1);
  });

  it('exposes an error when the API is unavailable', async () => {
    api.sportCompetitions.mockReturnValue(throwError(() => new Error('503')));
    const store = TestBed.inject(SportsStore);
    await store.loadCompetitions('FOOTBALL');
    expect(store.error()).toBe('Compétitions indisponibles pour le moment');
  });
});
