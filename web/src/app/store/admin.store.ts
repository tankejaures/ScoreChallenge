import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService, CreateGroupPayload, CreateMatchPayload } from '../core/api.service';
import { Group } from '../core/models';
import { GroupStore } from './group.store';

interface AdminState {
  detail: Group | null;
  saving: boolean;
  error: string | null;
}

const initialState: AdminState = { detail: null, saving: false, error: null };

export const AdminStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService), groupStore = inject(GroupStore)) => {
    async function reload(groupId: string): Promise<void> {
      const detail = await firstValueFrom(api.groupDetail(groupId));
      patchState(store, { detail });
    }

    return {
      reload,
      resetError(): void {
        patchState(store, { error: null });
      },
      async addParticipant(groupId: string, name: string): Promise<void> {
        patchState(store, { saving: true, error: null });
        try {
          await firstValueFrom(api.addParticipant(groupId, name));
          await reload(groupId);
          patchState(store, { saving: false });
        } catch (error) {
          const status = (error as HttpErrorResponse).status;
          patchState(store, {
            saving: false,
            error:
              status === 409
                ? 'Limite de 50 participants atteinte'
                : 'Impossible d’ajouter ce participant',
          });
          throw error;
        }
      },
      async removeParticipant(groupId: string, participantId: string): Promise<void> {
        await firstValueFrom(api.removeParticipant(groupId, participantId));
        await reload(groupId);
      },
      async createMatch(groupId: string, payload: CreateMatchPayload): Promise<void> {
        patchState(store, { saving: true, error: null });
        try {
          await firstValueFrom(api.createMatch(groupId, payload));
          await groupStore.loadMatches(groupId);
          patchState(store, { saving: false });
        } catch (error) {
          const status = (error as HttpErrorResponse).status;
          patchState(store, {
            saving: false,
            error:
              status === 400
                ? 'La date limite doit précéder le coup d’envoi'
                : 'Création du match impossible',
          });
          throw error;
        }
      },
      async updateMatch(
        groupId: string,
        matchId: string,
        payload: Partial<CreateMatchPayload>,
      ): Promise<void> {
        await firstValueFrom(api.updateMatch(groupId, matchId, payload));
        await groupStore.loadMatches(groupId);
      },
      async setResult(
        groupId: string,
        matchId: string,
        scoreA: number,
        scoreB: number,
      ): Promise<void> {
        patchState(store, { saving: true, error: null });
        try {
          await firstValueFrom(api.setResult(groupId, matchId, scoreA, scoreB));
          await Promise.all([groupStore.loadMatches(groupId), groupStore.loadRanking(groupId)]);
          patchState(store, { saving: false });
        } catch (error) {
          patchState(store, { saving: false, error: 'Enregistrement du résultat impossible' });
          throw error;
        }
      },
      async updateScoring(groupId: string, payload: Partial<CreateGroupPayload>): Promise<void> {
        patchState(store, { saving: true, error: null });
        try {
          await firstValueFrom(api.updateGroup(groupId, payload));
          await Promise.all([reload(groupId), groupStore.loadSummary(groupId)]);
          patchState(store, { saving: false });
        } catch (error) {
          patchState(store, { saving: false, error: 'Mise à jour du barème impossible' });
          throw error;
        }
      },
    };
  }),
);
