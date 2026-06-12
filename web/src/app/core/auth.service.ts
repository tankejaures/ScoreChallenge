import { Injectable, computed, signal } from '@angular/core';
import { AuthResult, ParticipantSession, User } from './models';

const OWNER_KEY = 'sc.owner';
const PARTICIPANT_PREFIX = 'sc.participant.';

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ownerSession = signal<AuthResult | null>(readJson<AuthResult>(OWNER_KEY));

  readonly activeGroupId = signal<string | null>(null);
  readonly user = computed<User | null>(() => this.ownerSession()?.user ?? null);
  readonly isLoggedIn = computed(() => this.ownerSession() !== null);

  setOwnerSession(auth: AuthResult): void {
    localStorage.setItem(OWNER_KEY, JSON.stringify(auth));
    this.ownerSession.set(auth);
  }

  clearOwnerSession(): void {
    localStorage.removeItem(OWNER_KEY);
    this.ownerSession.set(null);
  }

  setParticipantSession(session: ParticipantSession): void {
    localStorage.setItem(PARTICIPANT_PREFIX + session.groupId, JSON.stringify(session));
  }

  participantSession(groupId: string): ParticipantSession | null {
    return readJson<ParticipantSession>(PARTICIPANT_PREFIX + groupId);
  }

  tokenForRequest(): string | null {
    const groupId = this.activeGroupId();
    if (groupId) {
      const participant = this.participantSession(groupId);
      if (participant) {
        return participant.token;
      }
    }
    return this.ownerSession()?.token ?? null;
  }

  canAccessGroup(groupId: string): boolean {
    return this.participantSession(groupId) !== null || this.isLoggedIn();
  }
}
