import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Competition, FixtureView, Sport } from '../core/models';

interface SportsState {
  competitions: Competition[];
  fixtures: FixtureView[];
  loading: boolean;
  error: string | null;
}

const initialState: SportsState = {
  competitions: [],
  fixtures: [],
  loading: false,
  error: null,
};

export const SportsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => ({
    async loadCompetitions(sport: Sport): Promise<void> {
      patchState(store, { loading: true, error: null, competitions: [] });
      try {
        const competitions = await firstValueFrom(api.sportCompetitions(sport));
        patchState(store, { competitions, loading: false });
      } catch {
        patchState(store, {
          loading: false,
          error: 'Compétitions indisponibles pour le moment',
        });
      }
    },
    async loadFixtures(sport: Sport, leagueId: number, season: string): Promise<void> {
      patchState(store, { loading: true, error: null, fixtures: [] });
      try {
        const fixtures = await firstValueFrom(
          api.competitionFixtures(sport, leagueId, season),
        );
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
