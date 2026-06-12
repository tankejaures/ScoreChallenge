import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService, CreateGroupPayload } from '../core/api.service';
import { Group } from '../core/models';

interface GroupsState {
  groups: Group[];
  loading: boolean;
  error: string | null;
}

const initialState: GroupsState = { groups: [], loading: false, error: null };

export const GroupsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const groups = await firstValueFrom(api.myGroups());
        patchState(store, { groups, loading: false });
      } catch {
        patchState(store, { loading: false, error: 'Impossible de charger vos groupes' });
      }
    },
    async create(payload: CreateGroupPayload): Promise<Group> {
      const group = await firstValueFrom(api.createGroup(payload));
      patchState(store, { groups: [group, ...store.groups()] });
      return group;
    },
  })),
);
