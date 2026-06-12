import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Competition, FixtureView } from '../core/models';

interface FootballState {
  competitions: Competition[];
  fixtures: FixtureView[];
  loading: boolean;
  error: string | null;
}

const initialState: FootballState = {
  competitions: [],
  fixtures: [],
  loading: false,
  error: null,
};

export const FootballStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => ({
    async loadCompetitions(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const competitions = await firstValueFrom(api.footballCompetitions());
        patchState(store, { competitions, loading: false });
      } catch {
        patchState(store, {
          loading: false,
          error: 'Compétitions indisponibles pour le moment',
        });
      }
    },
    async loadFixtures(leagueId: number, season: number): Promise<void> {
      patchState(store, { loading: true, error: null, fixtures: [] });
      try {
        const fixtures = await firstValueFrom(api.competitionFixtures(leagueId, season));
        patchState(store, { fixtures, loading: false });
      } catch {
        patchState(store, {
          loading: false,
          error: 'Calendrier indisponible pour le moment',
        });
      }
    },
    resetFixtures(): void {
      patchState(store, { fixtures: [] });
    },
  })),
);
