import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { InviteInfo } from '../core/models';

interface JoinState {
  info: InviteInfo | null;
  notFound: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: JoinState = { info: null, notFound: false, loading: false, error: null };

export const JoinStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService), auth = inject(AuthService)) => ({
    async loadInvite(inviteToken: string): Promise<void> {
      patchState(store, initialState);
      try {
        const info = await firstValueFrom(api.inviteInfo(inviteToken));
        patchState(store, { info });
      } catch {
        patchState(store, { notFound: true });
      }
    },
    async join(inviteToken: string, code: string): Promise<string> {
      patchState(store, { loading: true, error: null });
      try {
        const result = await firstValueFrom(api.joinGroup(inviteToken, code.toUpperCase()));
        auth.setParticipantSession({ ...result, groupName: store.info()?.name ?? '' });
        patchState(store, { loading: false });
        return result.groupId;
      } catch (error) {
        const status = (error as HttpErrorResponse).status;
        patchState(store, {
          loading: false,
          error:
            status === 429
              ? 'Trop de tentatives. Réessayez dans une minute.'
              : status === 401
                ? 'Code invalide. Vérifiez auprès de l’organisateur.'
                : 'Une erreur est survenue. Réessayez.',
        });
        throw error;
      }
    },
  })),
);
