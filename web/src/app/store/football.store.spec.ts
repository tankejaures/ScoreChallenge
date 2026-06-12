import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { Competition, FixtureView } from '../core/models';
import { FootballStore } from './football.store';

const worldCup: Competition = {
  leagueId: 1,
  name: 'World Cup',
  type: 'Cup',
  logo: 'wc.png',
  country: 'World',
  season: 2026,
};

const fixture = (id: string, round: string): FixtureView => ({
  id,
  externalId: 1,
  leagueId: 1,
  season: 2026,
  round,
  teamA: 'France',
  teamB: 'Brésil',
  teamALogo: null,
  teamBLogo: null,
  kickoffAt: new Date().toISOString(),
  status: 'SCHEDULED',
  minute: null,
  scoreA: null,
  scoreB: null,
});

describe('FootballStore', () => {
  const api = {
    footballCompetitions: vi.fn(),
    competitionFixtures: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api as unknown as ApiService }],
    });
  });

  it('loads competitions', async () => {
    api.footballCompetitions.mockReturnValue(of([worldCup]));
    const store = TestBed.inject(FootballStore);
    await store.loadCompetitions();
    expect(store.competitions()).toEqual([worldCup]);
    expect(store.loading()).toBe(false);
  });

  it('loads fixtures for a competition', async () => {
    api.competitionFixtures.mockReturnValue(of([fixture('f1', 'Group A - 1')]));
    const store = TestBed.inject(FootballStore);
    await store.loadFixtures(1, 2026);
    expect(store.fixtures().length).toBe(1);
  });

  it('exposes an error when the API is unavailable', async () => {
    api.footballCompetitions.mockReturnValue(throwError(() => new Error('503')));
    const store = TestBed.inject(FootballStore);
    await store.loadCompetitions();
    expect(store.error()).toBe('Compétitions indisponibles pour le moment');
  });
});
