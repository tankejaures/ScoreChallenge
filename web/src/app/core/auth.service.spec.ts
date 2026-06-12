import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AuthResult, ParticipantSession } from './models';

describe('AuthService', () => {
  let service: AuthService;
  const owner: AuthResult = {
    token: 'owner-jwt',
    user: { id: 'u1', email: 'a@b.c', name: 'Aline' },
  };
  const session: ParticipantSession = {
    token: 'participant-jwt',
    groupId: 'g1',
    groupName: 'CdM 2026',
    participant: { id: 'p1', name: 'Marc' },
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('persists and restores the owner session', () => {
    service.setOwnerSession(owner);
    expect(service.isLoggedIn()).toBe(true);
    const fresh = new AuthService();
    expect(fresh.user()?.name).toBe('Aline');
  });

  it('clears the owner session on logout', () => {
    service.setOwnerSession(owner);
    service.clearOwnerSession();
    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('sc.owner')).toBeNull();
  });

  it('stores participant sessions per group', () => {
    service.setParticipantSession(session);
    expect(service.participantSession('g1')?.participant.name).toBe('Marc');
    expect(service.participantSession('g2')).toBeNull();
  });

  it('clears a participant session for one group only', () => {
    service.setParticipantSession(session);
    service.setParticipantSession({ ...session, groupId: 'g2' });
    service.clearParticipantSession('g1');
    expect(service.participantSession('g1')).toBeNull();
    expect(service.participantSession('g2')).not.toBeNull();
  });

  it('prefers the participant token inside its group context', () => {
    service.setOwnerSession(owner);
    service.setParticipantSession(session);
    service.activeGroupId.set('g1');
    expect(service.tokenForRequest()).toBe('participant-jwt');
  });

  it('falls back to the owner token outside participant groups', () => {
    service.setOwnerSession(owner);
    service.activeGroupId.set('g-owned');
    expect(service.tokenForRequest()).toBe('owner-jwt');
    service.activeGroupId.set(null);
    expect(service.tokenForRequest()).toBe('owner-jwt');
  });

  it('returns null without any session', () => {
    expect(service.tokenForRequest()).toBeNull();
  });

  it('canAccessGroup is true for participant session or logged-in owner', () => {
    expect(service.canAccessGroup('g1')).toBe(false);
    service.setParticipantSession(session);
    expect(service.canAccessGroup('g1')).toBe(true);
    expect(service.canAccessGroup('g2')).toBe(false);
    service.setOwnerSession(owner);
    expect(service.canAccessGroup('g2')).toBe(true);
  });
});
