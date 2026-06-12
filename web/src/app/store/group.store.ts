import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { GroupStats, GroupSummary, MatchView, Prediction, RankingEntry } from '../core/models';

interface GroupState {
  summary: GroupSummary | null;
  matches: MatchView[];
  ranking: RankingEntry[];
  stats: GroupStats | null;
  myStats: RankingEntry | null;
  loading: boolean;
  error: string | null;
}

const initialState: GroupState = {
  summary: null,
  matches: [],
  ranking: [],
  stats: null,
  myStats: null,
  loading: false,
  error: null,
};

export const GroupStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => ({
    reset(): void {
      patchState(store, initialState);
    },
    async loadSummary(groupId: string): Promise<void> {
      const summary = await firstValueFrom(api.groupSummary(groupId));
      patchState(store, { summary });
    },
    async loadMatches(groupId: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const matches = await firstValueFrom(api.listMatches(groupId));
        patchState(store, { matches, loading: false });
      } catch {
        patchState(store, { loading: false, error: 'Impossible de charger les matchs' });
      }
    },
    async loadRanking(groupId: string): Promise<void> {
      const ranking = await firstValueFrom(api.ranking(groupId));
      patchState(store, { ranking });
    },
    async loadStats(groupId: string): Promise<void> {
      const stats = await firstValueFrom(api.groupStats(groupId));
      patchState(store, { stats });
    },
    async loadMyStats(groupId: string, participantId: string): Promise<void> {
      const myStats = await firstValueFrom(api.participantStats(groupId, participantId));
      patchState(store, { myStats });
    },
    async submitPrediction(matchId: string, scoreA: number, scoreB: number): Promise<void> {
      const previous = store.matches();
      const optimistic = previous.map((m) =>
        m.id === matchId
          ? {
              ...m,
              myPrediction: {
                ...(m.myPrediction ?? {
                  id: 'optimistic',
                  matchId,
                  participantId: '',
                  editCount: 0,
                  lockedAt: null,
                  points: null,
                }),
                scoreA,
                scoreB,
              } as Prediction,
            }
          : m,
      );
      patchState(store, { matches: optimistic });
      try {
        const saved = await firstValueFrom(api.submitPrediction(matchId, scoreA, scoreB));
        patchState(store, {
          matches: store
            .matches()
            .map((m) => (m.id === matchId ? { ...m, myPrediction: saved } : m)),
        });
      } catch (error) {
        patchState(store, { matches: previous });
        throw error;
      }
    },
  })),
);
