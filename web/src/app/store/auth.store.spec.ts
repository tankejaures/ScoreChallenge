import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  const api = {
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  };
  const auth = {
    setOwnerSession: vi.fn(),
    clearOwnerSession: vi.fn(),
    user: () => null,
    isLoggedIn: () => false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api as unknown as ApiService },
        { provide: AuthService, useValue: auth as unknown as AuthService },
      ],
    });
  });

  it('persists the session on successful login', async () => {
    const result = { token: 't', user: { id: 'u1', email: 'a@b.c', name: 'A' } };
    api.login.mockReturnValue(of(result));
    const store = TestBed.inject(AuthStore);
    await store.login('a@b.c', 'secret123');
    expect(auth.setOwnerSession).toHaveBeenCalledWith(result);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('exposes an error message on failed login without persisting', async () => {
    api.login.mockReturnValue(throwError(() => ({ status: 401 })));
    const store = TestBed.inject(AuthStore);
    await expect(store.login('a@b.c', 'bad')).rejects.toBeDefined();
    expect(auth.setOwnerSession).not.toHaveBeenCalled();
    expect(store.error()).toBe('Identifiants invalides');
  });

  it('clears the session on logout', () => {
    const store = TestBed.inject(AuthStore);
    store.logout();
    expect(auth.clearOwnerSession).toHaveBeenCalled();
  });
});
