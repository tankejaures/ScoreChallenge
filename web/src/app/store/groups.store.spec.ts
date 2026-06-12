import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { GroupsStore } from './groups.store';
import { Group } from '../core/models';

const fakeGroup = (id: string, name: string): Group => ({
  id,
  name,
  description: null,
  inviteToken: 'tok',
  ownerId: 'u1',
  scoringExactScore: 5,
  scoringCorrectOutcome: 3,
  scoringOneTeamScore: 1,
  createdAt: new Date().toISOString(),
});

describe('GroupsStore', () => {
  const api = {
    myGroups: vi.fn(),
    createGroup: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api as unknown as ApiService }],
    });
  });

  it('loads my groups', async () => {
    api.myGroups.mockReturnValue(of([fakeGroup('g1', 'CdM')]));
    const store = TestBed.inject(GroupsStore);
    await store.load();
    expect(store.groups().length).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('prepends a created group', async () => {
    api.myGroups.mockReturnValue(of([]));
    api.createGroup.mockReturnValue(of(fakeGroup('g2', 'Ligue')));
    const store = TestBed.inject(GroupsStore);
    await store.load();
    await store.create({ name: 'Ligue' });
    expect(store.groups()[0].name).toBe('Ligue');
  });
});
