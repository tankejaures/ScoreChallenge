import { inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';

interface AuthState {
  loading: boolean;
  error: string | null;
  infoMessage: string | null;
}

const initialState: AuthState = { loading: false, error: null, infoMessage: null };

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((_store, auth = inject(AuthService)) => ({
    user: auth.user,
    isLoggedIn: auth.isLoggedIn,
  })),
  withMethods((store, api = inject(ApiService), auth = inject(AuthService)) => ({
    resetMessages(): void {
      patchState(store, { error: null, infoMessage: null });
    },
    async login(email: string, password: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const result = await firstValueFrom(api.login(email, password));
        auth.setOwnerSession(result);
        patchState(store, { loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: 'Identifiants invalides' });
        throw error;
      }
    },
    async register(email: string, password: string, name: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const result = await firstValueFrom(api.register(email, password, name));
        auth.setOwnerSession(result);
        patchState(store, { loading: false });
      } catch (error) {
        const status = (error as { status?: number }).status;
        patchState(store, {
          loading: false,
          error:
            status === 409
              ? 'Un compte existe déjà avec cet email'
              : 'Inscription impossible, vérifiez les champs',
        });
        throw error;
      }
    },
    async forgotPassword(email: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      await firstValueFrom(api.forgotPassword(email)).catch(() => undefined);
      patchState(store, {
        loading: false,
        infoMessage: 'Si un compte existe, un email a été envoyé.',
      });
    },
    async resetPassword(token: string, password: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        await firstValueFrom(api.resetPassword(token, password));
        patchState(store, { loading: false, infoMessage: 'Mot de passe mis à jour.' });
      } catch (error) {
        patchState(store, { loading: false, error: 'Lien invalide ou expiré' });
        throw error;
      }
    },
    logout(): void {
      auth.clearOwnerSession();
    },
    leaveGroup(groupId: string): void {
      auth.clearParticipantSession(groupId);
    },
  })),
);
