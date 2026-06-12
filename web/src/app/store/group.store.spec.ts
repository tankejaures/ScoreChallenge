import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { GroupStore } from './group.store';
import { MatchView, Prediction } from '../core/models';

const match = (id: string, partial: Partial<MatchView> = {}): MatchView => ({
  id,
  groupId: 'g1',
  teamA: 'France',
  teamB: 'Brésil',
  kickoffAt: '2030-06-15T16:00:00.000Z',
  predictionDeadline: '2030-06-15T15:00:00.000Z',
  finalScoreA: null,
  finalScoreB: null,
  status: 'UPCOMING',
  myPrediction: null,
  predictions: [],
  ...partial,
});

describe('GroupStore', () => {
  const api = {
    groupSummary: vi.fn(),
    listMatches: vi.fn(),
    ranking: vi.fn(),
    groupStats: vi.fn(),
    participantStats: vi.fn(),
    submitPrediction: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api as unknown as ApiService }],
    });
  });

  it('loads matches for a group', async () => {
    api.listMatches.mockReturnValue(of([match('m1')]));
    const store = TestBed.inject(GroupStore);
    await store.loadMatches('g1');
    expect(store.matches().length).toBe(1);
  });

  it('applies optimistic prediction then reconciles with server response', async () => {
    api.listMatches.mockReturnValue(of([match('m1')]));
    const saved: Prediction = {
      id: 'pr1',
      matchId: 'm1',
      participantId: 'p1',
      scoreA: 2,
      scoreB: 1,
      editCount: 0,
      lockedAt: null,
      points: null,
    };
    api.submitPrediction.mockReturnValue(of(saved));
    const store = TestBed.inject(GroupStore);
    await store.loadMatches('g1');
    await store.submitPrediction('m1', 2, 1);
    expect(store.matches()[0].myPrediction?.scoreA).toBe(2);
    expect(store.matches()[0].myPrediction?.id).toBe('pr1');
  });

  it('rolls back the optimistic prediction on error', async () => {
    api.listMatches.mockReturnValue(of([match('m1')]));
    api.submitPrediction.mockReturnValue(throwError(() => new Error('403')));
    const store = TestBed.inject(GroupStore);
    await store.loadMatches('g1');
    await expect(store.submitPrediction('m1', 2, 1)).rejects.toThrow();
    expect(store.matches()[0].myPrediction).toBeNull();
  });
});
