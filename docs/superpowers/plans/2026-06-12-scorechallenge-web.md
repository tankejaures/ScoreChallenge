# ScoreChallenge Web — Implementation Plan (Plan 2/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le frontend Angular de ScoreChallenge (auth, dashboard, parcours invité, pronostics, classements, admin) avec un design premium mobile-first, branché sur l'API NestJS livrée par le Plan 1.

**Architecture:** App Angular 21+ standalone et zoneless par défaut (signals, control flow `@if/@for`), NgRx Signal Store par domaine, PrimeNG (thème custom) + Tailwind CSS 4. Sessions doubles : owner (JWT email/mot de passe) et participant (JWT par groupe obtenu via code). Proxy dev vers l'API (port 3000), PostgreSQL local sur **5435**.

**Tech Stack:** Angular 21+ (dernière version, `@angular/cli@latest`), @ngrx/signals, PrimeNG + @primeuix/themes, Tailwind CSS 4, **Vitest** (runner par défaut Angular 21 — syntaxe `vi.fn()`, `expect` vitest, PAS Jasmine/Karma), API NestJS existante.

**Spec:** `docs/superpowers/specs/2026-06-12-scorechallenge-design.md` (section Frontend + exigence design premium)

---

## Conventions globales

- Commandes depuis la racine sauf mention contraire. Frontend dans `web/`.
- Conventional Commits en anglais, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Lint + build verts avant chaque commit. Textes UI en français avec accents corrects et apostrophes typographiques (’).
- **Architecture en couches (RÈGLE STRICTE)** : `ApiService` (HTTP) → **NgRx Signal Store** (état + actions) → composants. **AUCUN composant n'injecte `ApiService` ni ne fait d'appel HTTP** — les composants n'injectent que des stores (plus `AuthService` en lecture seule de session là où le shell/les guards en ont besoin). Tout état (données, loading, error) vit dans un store. `AuthService` reste un service bas niveau (persistance localStorage + `tokenForRequest` pour l'intercepteur) consommé PAR les stores, jamais utilisé pour du HTTP.
- Stores du projet : `AuthStore` (actions auth + état de session exposé aux composants), `JoinStore` (parcours invité), `GroupsStore` (dashboard), `GroupStore` (groupe actif : résumé, matchs, pronostics, classement, stats groupe, mes stats), `AdminStore` (gestion owner).
- **Contrat design** : les templates de ce plan sont fonctionnels et volontairement sobres. La Tâche 12 (skill `frontend-design`) restyle librement MAIS ne change ni les APIs des stores/services, ni les `data-testid`, ni les comportements testés.

---

### Task 1: API — résumé de groupe accessible aux membres

Le frontend (header de groupe, affichage du barème côté participant) a besoin d'un endpoint membre. `GET /groups/:id` reste owner-only.

**Files:**
- Modify: `api/src/groups/groups.service.ts`, `groups.controller.ts`
- Test: `api/test/group-summary.e2e-spec.ts`

- [ ] **Step 1: Test e2e qui échoue**

`api/test/group-summary.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

interface SummaryBody {
  id: string;
  name: string;
  description: string | null;
  scoringExactScore: number;
  scoringCorrectOutcome: number;
  scoringOneTeamScore: number;
  participantCount: number;
  isOwner: boolean;
  inviteToken?: string;
}

describe('Group summary (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let groupId: string;
  let inviteToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    ownerToken = await registerOwner(app);
    const group = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CdM 2026', description: 'Open space' })
      .expect(201);
    groupId = (group.body as { id: string }).id;
    inviteToken = (group.body as { inviteToken: string }).inviteToken;
  });

  afterAll(() => app.close());

  it('returns summary with scoring config and isOwner=true for the owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/summary`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = res.body as SummaryBody;
    expect(body.name).toBe('CdM 2026');
    expect(body.scoringExactScore).toBe(5);
    expect(body.participantCount).toBe(1);
    expect(body.isOwner).toBe(true);
    expect(body.inviteToken).toBeUndefined();
  });

  it('returns summary with isOwner=false for a joined participant', async () => {
    const participant = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    const joined = await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken, code: (participant.body as { code: string }).code })
      .expect(201);
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/summary`)
      .set('Authorization', `Bearer ${(joined.body as { token: string }).token}`)
      .expect(200);
    const body = res.body as SummaryBody;
    expect(body.isOwner).toBe(false);
    expect(body.participantCount).toBe(2);
  });

  it('rejects a participant JWT from another group with 403', async () => {
    const otherOwner = await registerOwner(app, 'other@test.io');
    const otherGroup = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${otherOwner}`)
      .send({ name: 'Autre' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/groups/${(otherGroup.body as { id: string }).id}/summary`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `dotenv -e .env.test -- npx jest --config ./test/jest-e2e.json --runInBand -t 'summary'` → FAIL (404).

- [ ] **Step 3: Implémenter**

Ajout dans `GroupsService` (import `JwtPayload` en `import type`) :

```typescript
async getSummary(groupId: string, user: JwtPayload) {
  const group = await this.prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { participants: true } } },
  });
  if (!group) {
    throw new NotFoundException('Groupe introuvable');
  }
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    scoringExactScore: group.scoringExactScore,
    scoringCorrectOutcome: group.scoringCorrectOutcome,
    scoringOneTeamScore: group.scoringOneTeamScore,
    participantCount: group._count.participants,
    isOwner: user.role === 'owner' && group.ownerId === user.sub,
  };
}
```

Ajout dans `GroupsController` (le `GroupMemberGuard` autorise owner du groupe OU participant du groupe) :

```typescript
@UseGuards(GroupMemberGuard)
@Get(':id/summary')
getSummary(@Param('id') id: string, @Req() req: RequestWithUser) {
  return this.groupsService.getSummary(id, req.user!);
}
```

- [ ] **Step 4: Vérifier le succès + suite complète**

Run (dans `api/`): suite e2e complète → 92 tests verts (89 + 3). `npm run lint && npm run build` propres.

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat: add member-accessible group summary endpoint"
```

---

### Task 2: Scaffold Angular + Tailwind 4 + PrimeNG + Makefile

**Files:**
- Create: `web/` (scaffold Angular CLI)
- Create: `web/.postcssrc.json`, `web/proxy.conf.json`
- Modify: `web/src/styles.css`, `web/src/app/app.config.ts`, `web/package.json`, `Makefile`

- [ ] **Step 1: Scaffolder l'app**

Run (racine): `npx @angular/cli@latest new web --style=css --ssr=false --skip-git`
Expected: dossier `web/` — Angular **21+**, standalone, routing inclus, **zoneless par défaut** (pas de zone.js), **Vitest** comme runner de tests par défaut. Vérifier la version générée dans `web/package.json` (`@angular/core` ≥ 21). Si le scaffold propose des options interactives, accepter les défauts (zoneless, vitest).

- [ ] **Step 2: Installer Tailwind 4 + PrimeNG**

Run (dans `web/`):
```bash
npm install tailwindcss @tailwindcss/postcss postcss
npm install primeng @primeuix/themes @ngrx/signals
```

`web/.postcssrc.json` :

```json
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

`web/src/styles.css` :

```css
@import 'tailwindcss';

:root {
  --sc-font: 'Inter', system-ui, sans-serif;
}

html,
body {
  height: 100%;
  margin: 0;
  font-family: var(--sc-font);
}
```

- [ ] **Step 3: Configurer PrimeNG avec préset custom**

`web/src/app/theme.ts` :

```typescript
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Préset de base — la passe design premium (Task 12) l'enrichira.
export const ScPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{emerald.50}',
      100: '{emerald.100}',
      200: '{emerald.200}',
      300: '{emerald.300}',
      400: '{emerald.400}',
      500: '{emerald.500}',
      600: '{emerald.600}',
      700: '{emerald.700}',
      800: '{emerald.800}',
      900: '{emerald.900}',
      950: '{emerald.950}',
    },
  },
});
```

`web/src/app/app.config.ts` :

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { ScPreset } from './theme';
import { authInterceptor } from './core/auth.interceptor';

// Angular 21 : zoneless par défaut — conserver les providers générés par le scaffold
// (ex. provideBrowserGlobalErrorListeners) et y AJOUTER ceux-ci.
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({ theme: { preset: ScPreset, options: { darkModeSelector: '.sc-dark' } } }),
  ],
};
```

(`authInterceptor` arrive en Task 3 — créer un fichier stub temporaire qui exporte un interceptor pass-through pour que le build passe :)

```typescript
// web/src/app/core/auth.interceptor.ts (stub Task 2, complété Task 3)
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => next(req);
```

- [ ] **Step 4: Proxy dev vers l'API**

`web/proxy.conf.json` :

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "pathRewrite": { "^/api": "" }
  }
}
```

Dans `web/angular.json`, cible `serve` → `options` : `"proxyConfig": "proxy.conf.json"`.

- [ ] **Step 5: Makefile racine — cibles web**

Remplacer/compléter dans `Makefile` :

```makefile
install: ## Installe les dépendances
	cd $(API_DIR) && npm install
	cd $(WEB_DIR) && npm install

dev-web: ## Lance le frontend Angular (proxy vers l'API)
	cd $(WEB_DIR) && npm start

test-web: ## Tests unitaires web (vitest)
	cd $(WEB_DIR) && npm test -- --no-watch

test: test-api test-e2e test-web ## Tous les tests

build: ## Build api + web
	cd $(API_DIR) && npm run build
	cd $(WEB_DIR) && npm run build
```

- [ ] **Step 6: Vérifier**

Run (dans `web/`): `npm run build` → succès. `npm test -- --no-watch` → tests du scaffold verts (vitest).

- [ ] **Step 7: Commit**

```bash
git add web Makefile
git commit -m "chore: scaffold Angular app with Tailwind, PrimeNG theme and dev proxy"
```

---

### Task 3: Core — modèles, ApiService, AuthService (sessions), intercepteur, guards

**Files:**
- Create: `web/src/app/core/models.ts`
- Create: `web/src/app/core/api.service.ts`
- Create: `web/src/app/core/auth.service.ts`
- Modify: `web/src/app/core/auth.interceptor.ts`
- Create: `web/src/app/core/guards.ts`
- Test: `web/src/app/core/auth.service.spec.ts`, `web/src/app/core/api.service.spec.ts`

- [ ] **Step 1: Modèles (contrat API réel du Plan 1)**

`web/src/app/core/models.ts` :

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface Participant {
  id: string;
  groupId: string;
  name: string;
  code?: string;
  userId: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  inviteToken: string;
  ownerId: string;
  scoringExactScore: number;
  scoringCorrectOutcome: number;
  scoringOneTeamScore: number;
  createdAt: string;
  participants?: Participant[];
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  scoringExactScore: number;
  scoringCorrectOutcome: number;
  scoringOneTeamScore: number;
  participantCount: number;
  isOwner: boolean;
}

export type MatchStatus = 'UPCOMING' | 'LIVE' | 'FINISHED';

export interface Prediction {
  id: string;
  matchId: string;
  participantId: string;
  scoreA: number;
  scoreB: number;
  editCount: number;
  lockedAt: string | null;
  points: number | null;
  participant?: { id: string; name: string };
}

export interface MatchView {
  id: string;
  groupId: string;
  teamA: string;
  teamB: string;
  kickoffAt: string;
  predictionDeadline: string;
  finalScoreA: number | null;
  finalScoreB: number | null;
  status: MatchStatus;
  myPrediction: Prediction | null;
  predictions: Prediction[];
}

export interface RankingEntry {
  id: string;
  name: string;
  totalPoints: number;
  matchesPlayed: number;
  correctPredictions: number;
  exactScores: number;
  correctOutcomes: number;
  rank: number;
  successRate: number;
  averagePoints: number;
}

export interface GroupStats {
  participantCount: number;
  matchCount: number;
  averagePointsPerPlayer: number;
  bestPlayer: RankingEntry | null;
  mostExactScores: RankingEntry | null;
  ranking: RankingEntry[];
}

export interface InviteInfo {
  name: string;
  description: string | null;
}

export interface JoinResult {
  token: string;
  groupId: string;
  participant: { id: string; name: string };
}

export interface ParticipantSession extends JoinResult {
  groupName: string;
}
```

- [ ] **Step 2: AuthService — tests d'abord**

`web/src/app/core/auth.service.spec.ts` :

```typescript
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
```

- [ ] **Step 3: Run (FAIL), puis implémenter AuthService**

`web/src/app/core/auth.service.ts` :

```typescript
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
```

Run: tests AuthService verts.

- [ ] **Step 4: ApiService typé + test HttpTestingController**

`web/src/app/core/api.service.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts credentials to /api/auth/login', () => {
    let result: unknown;
    service.login('a@b.c', 'secret123').subscribe((r) => (result = r));
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({ token: 't', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
    expect(result).toEqual(expect.objectContaining({ token: 't' }));
  });

  it('puts a prediction to /api/matches/:id/prediction', () => {
    service.submitPrediction('m1', 2, 1).subscribe();
    const req = http.expectOne('/api/matches/m1/prediction');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ scoreA: 2, scoreB: 1 });
    req.flush({});
  });
});
```

`web/src/app/core/api.service.ts` :

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuthResult,
  Group,
  GroupStats,
  GroupSummary,
  InviteInfo,
  JoinResult,
  MatchView,
  Participant,
  Prediction,
  RankingEntry,
} from './models';

const BASE = '/api';

export interface CreateGroupPayload {
  name: string;
  description?: string;
  scoringExactScore?: number;
  scoringCorrectOutcome?: number;
  scoringOneTeamScore?: number;
}

export interface CreateMatchPayload {
  teamA: string;
  teamB: string;
  kickoffAt: string;
  predictionDeadline: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // Auth
  register(email: string, password: string, name: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${BASE}/auth/register`, { email, password, name });
  }
  login(email: string, password: string): Observable<AuthResult> {
    return this.http.post<AuthResult>(`${BASE}/auth/login`, { email, password });
  }
  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${BASE}/auth/forgot-password`, { email });
  }
  resetPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${BASE}/auth/reset-password`, { token, password });
  }

  // Groups
  createGroup(payload: CreateGroupPayload): Observable<Group> {
    return this.http.post<Group>(`${BASE}/groups`, payload);
  }
  myGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${BASE}/groups`);
  }
  groupDetail(groupId: string): Observable<Group> {
    return this.http.get<Group>(`${BASE}/groups/${groupId}`);
  }
  updateGroup(groupId: string, payload: Partial<CreateGroupPayload>): Observable<Group> {
    return this.http.patch<Group>(`${BASE}/groups/${groupId}`, payload);
  }
  groupSummary(groupId: string): Observable<GroupSummary> {
    return this.http.get<GroupSummary>(`${BASE}/groups/${groupId}/summary`);
  }
  inviteInfo(token: string): Observable<InviteInfo> {
    return this.http.get<InviteInfo>(`${BASE}/groups/invite/${token}`);
  }
  joinGroup(inviteToken: string, code: string): Observable<JoinResult> {
    return this.http.post<JoinResult>(`${BASE}/groups/join`, { inviteToken, code });
  }

  // Participants
  addParticipant(groupId: string, name: string): Observable<Participant> {
    return this.http.post<Participant>(`${BASE}/groups/${groupId}/participants`, { name });
  }
  removeParticipant(groupId: string, participantId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/groups/${groupId}/participants/${participantId}`);
  }

  // Matches
  createMatch(groupId: string, payload: CreateMatchPayload): Observable<MatchView> {
    return this.http.post<MatchView>(`${BASE}/groups/${groupId}/matches`, payload);
  }
  updateMatch(
    groupId: string,
    matchId: string,
    payload: Partial<CreateMatchPayload>,
  ): Observable<MatchView> {
    return this.http.patch<MatchView>(`${BASE}/groups/${groupId}/matches/${matchId}`, payload);
  }
  setResult(groupId: string, matchId: string, scoreA: number, scoreB: number): Observable<MatchView> {
    return this.http.post<MatchView>(`${BASE}/groups/${groupId}/matches/${matchId}/result`, {
      scoreA,
      scoreB,
    });
  }
  listMatches(groupId: string): Observable<MatchView[]> {
    return this.http.get<MatchView[]>(`${BASE}/groups/${groupId}/matches`);
  }

  // Predictions
  submitPrediction(matchId: string, scoreA: number, scoreB: number): Observable<Prediction> {
    return this.http.put<Prediction>(`${BASE}/matches/${matchId}/prediction`, { scoreA, scoreB });
  }

  // Stats
  ranking(groupId: string): Observable<RankingEntry[]> {
    return this.http.get<RankingEntry[]>(`${BASE}/groups/${groupId}/ranking`);
  }
  groupStats(groupId: string): Observable<GroupStats> {
    return this.http.get<GroupStats>(`${BASE}/groups/${groupId}/stats`);
  }
  participantStats(groupId: string, participantId: string): Observable<RankingEntry> {
    return this.http.get<RankingEntry>(
      `${BASE}/groups/${groupId}/participants/${participantId}/stats`,
    );
  }
}
```

- [ ] **Step 5: Intercepteur réel + guards**

`web/src/app/core/auth.interceptor.ts` (remplace le stub) :

```typescript
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.tokenForRequest();
  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
```

`web/src/app/core/guards.ts` :

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const ownerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

export const groupAccessGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const groupId = route.paramMap.get('id') ?? '';
  return auth.canAccessGroup(groupId) ? true : inject(Router).createUrlTree(['/login']);
};
```

- [ ] **Step 6: Vérifier**

Run (dans `web/`): `npm test -- --no-watch` → tous verts. `npm run build` propre.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat: add typed API client, dual-session auth service, interceptor and guards"
```

---

### Task 4: Auth — AuthStore + pages login / register / forgot / reset

**Files:**
- Create: `web/src/app/store/auth.store.ts`
- Create: `web/src/app/features/auth/login.component.ts`, `register.component.ts`, `forgot-password.component.ts`, `reset-password.component.ts`
- Modify: `web/src/app/app.routes.ts`, `web/src/app/app.ts` (shell minimal `<router-outlet/>`)
- Test: `web/src/app/store/auth.store.spec.ts`

- [ ] **Step 1: Routes**

`web/src/app/app.routes.ts` :

```typescript
import { Routes } from '@angular/router';
import { ownerGuard, groupAccessGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'dashboard',
    canActivate: [ownerGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'join/:inviteToken',
    loadComponent: () => import('./features/join/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'groups/:id',
    canActivate: [groupAccessGuard],
    loadComponent: () =>
      import('./features/group/group-shell.component').then((m) => m.GroupShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'matches' },
      {
        path: 'matches',
        loadComponent: () =>
          import('./features/group/matches-page.component').then((m) => m.MatchesPageComponent),
      },
      {
        path: 'ranking',
        loadComponent: () =>
          import('./features/group/ranking-page.component').then((m) => m.RankingPageComponent),
      },
      {
        path: 'stats',
        loadComponent: () =>
          import('./features/group/stats-page.component').then((m) => m.StatsPageComponent),
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./features/group-admin/admin-page.component').then((m) => m.AdminPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
```

(Les composants référencés arrivent dans les tâches 5-11 ; pour garder le build vert, créer chaque fichier au moment de sa tâche — dans CETTE tâche, ne déclarer que les routes auth + un `app.routes.ts` complet est acceptable si les fichiers des tâches suivantes sont créés en stubs minimaux dans leur tâche respective. Alternative simple : construire `app.routes.ts` incrémentalement, en n'ajoutant à chaque tâche que les routes de la feature livrée. Choisir l'approche incrémentale.)

- [ ] **Step 2: AuthStore (TDD)**

`web/src/app/store/auth.store.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  const api = { login: vi.fn(), register: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn() };
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
```

`web/src/app/store/auth.store.ts` :

```typescript
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
  })),
);
```

- [ ] **Step 3: LoginComponent (modèle pour les 3 autres — consomme UNIQUEMENT AuthStore)**

`web/src/app/features/auth/login.component.ts` :

```typescript
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'sc-login',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  template: `
    <div class="min-h-dvh flex items-center justify-center p-4">
      <form
        class="w-full max-w-sm flex flex-col gap-4"
        data-testid="login-form"
        (ngSubmit)="submit()"
      >
        <h1 class="text-2xl font-bold text-center">ScoreChallenge</h1>
        <p class="text-center text-sm opacity-70">Connexion organisateur</p>
        @if (store.error()) {
          <p-message severity="error" [text]="store.error()!" />
        }
        <input
          pInputText
          type="email"
          name="email"
          placeholder="Email"
          required
          [(ngModel)]="email"
          data-testid="login-email"
        />
        <p-password
          name="password"
          placeholder="Mot de passe"
          [feedback]="false"
          [toggleMask]="true"
          [(ngModel)]="password"
          data-testid="login-password"
        />
        <p-button
          type="submit"
          label="Se connecter"
          [loading]="store.loading()"
          styleClass="w-full"
          data-testid="login-submit"
        />
        <div class="flex justify-between text-sm">
          <a routerLink="/register" class="underline">Créer un compte</a>
          <a routerLink="/forgot-password" class="underline">Mot de passe oublié ?</a>
        </div>
      </form>
    </div>
  `,
})
export class LoginComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  email = '';
  password = '';

  async submit(): Promise<void> {
    try {
      await this.store.login(this.email, this.password);
      void this.router.navigate(['/dashboard']);
    } catch {
      // l'erreur est exposée par store.error()
    }
  }
}
```

- [ ] **Step 4: Les 3 autres pages auth (toutes via AuthStore uniquement)**

Même structure — appeler `store.resetMessages()` dans le constructeur de chaque page :
- `RegisterComponent` : champs name/email/password → `store.register(...)`, succès → `/dashboard`. Erreur affichée via `store.error()`.
- `ForgotPasswordComponent` : champ email → `store.forgotPassword(...)`, affiche `store.infoMessage()`.
- `ResetPasswordComponent` : lit `token` en query param (`inject(ActivatedRoute).snapshot.queryParamMap.get('token')`), champ nouveau mot de passe → `store.resetPassword(...)`, succès → `store.infoMessage()` + lien `/login` ; erreur via `store.error()`.

- [ ] **Step 5: Vérifier + commit**

`npm run build` + tests verts.

```bash
git add web
git commit -m "feat: add auth pages (login, register, password reset)"
```

---

### Task 5: Dashboard owner — mes groupes + création

**Files:**
- Create: `web/src/app/store/groups.store.ts`
- Create: `web/src/app/features/dashboard/dashboard.component.ts`
- Test: `web/src/app/store/groups.store.spec.ts`

- [ ] **Step 1: Store — test d'abord**

`web/src/app/store/groups.store.spec.ts` :

```typescript
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
```

- [ ] **Step 2: Run (FAIL), implémenter le store**

`web/src/app/store/groups.store.ts` :

```typescript
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
```

- [ ] **Step 3: DashboardComponent**

`web/src/app/features/dashboard/dashboard.component.ts` :

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { AuthStore } from '../../store/auth.store';
import { GroupsStore } from '../../store/groups.store';

@Component({
  selector: 'sc-dashboard',
  imports: [FormsModule, RouterLink, ButtonModule, DialogModule, InputTextModule, TextareaModule],
  template: `
    <div class="max-w-2xl mx-auto p-4 flex flex-col gap-4">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold">Mes groupes</h1>
          <p class="text-sm opacity-70">Bonjour {{ authStore.user()?.name }}</p>
        </div>
        <p-button label="Déconnexion" severity="secondary" [text]="true" (onClick)="logout()" />
      </header>

      <p-button
        label="Créer un groupe"
        icon="pi pi-plus"
        (onClick)="showCreate.set(true)"
        data-testid="create-group-button"
      />

      @if (store.loading()) {
        <p class="text-center opacity-70">Chargement…</p>
      } @else if (store.groups().length === 0) {
        <p class="text-center opacity-70" data-testid="empty-groups">
          Aucun groupe pour l’instant. Créez-en un pour lancer les pronostics !
        </p>
      }

      @for (group of store.groups(); track group.id) {
        <a
          [routerLink]="['/groups', group.id]"
          class="block rounded-xl border p-4 hover:shadow transition"
          data-testid="group-card"
        >
          <div class="font-semibold">{{ group.name }}</div>
          @if (group.description) {
            <div class="text-sm opacity-70">{{ group.description }}</div>
          }
        </a>
      }

      <p-dialog header="Nouveau groupe" [(visible)]="showCreateValue" [modal]="true" [style]="{ width: '24rem' }">
        <form class="flex flex-col gap-3" (ngSubmit)="create()">
          <input pInputText name="name" placeholder="Nom du groupe" required [(ngModel)]="name" />
          <textarea
            pTextarea
            name="description"
            placeholder="Description (optionnelle)"
            rows="3"
            [(ngModel)]="description"
          ></textarea>
          <p-button type="submit" label="Créer" [loading]="creating()" />
        </form>
      </p-dialog>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly store = inject(GroupsStore);
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  name = '';
  description = '';

  get showCreateValue(): boolean {
    return this.showCreate();
  }
  set showCreateValue(value: boolean) {
    this.showCreate.set(value);
  }

  ngOnInit(): void {
    void this.store.load();
  }

  async create(): Promise<void> {
    if (!this.name.trim()) {
      return;
    }
    this.creating.set(true);
    try {
      const group = await this.store.create({
        name: this.name.trim(),
        description: this.description.trim() || undefined,
      });
      void this.router.navigate(['/groups', group.id]);
    } finally {
      this.creating.set(false);
    }
  }

  logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 4: Routes (ajouter dashboard), vérifier, commit**

Tests + build verts.

```bash
git add web
git commit -m "feat: add owner dashboard with group creation"
```

---

### Task 6: Parcours invité — JoinStore + /join/:inviteToken

**Files:**
- Create: `web/src/app/store/join.store.ts`
- Create: `web/src/app/features/join/join.component.ts`
- Modify: `web/src/app/app.routes.ts`

- [ ] **Step 1: JoinStore**

Comportement : `loadInvite(token)` charge l'info publique (404 → `notFound`) ; `join(token, code)` échange le code, persiste la session participant via `AuthService` et retourne le `groupId`. Erreurs mappées : 401 → « Code invalide. Vérifiez auprès de l’organisateur. » ; 429 → « Trop de tentatives. Réessayez dans une minute. » ; autre → message générique.

`web/src/app/store/join.store.ts` :

```typescript
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
```

- [ ] **Step 2: JoinComponent (consomme UNIQUEMENT JoinStore)**

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputOtpModule } from 'primeng/inputotp';
import { MessageModule } from 'primeng/message';
import { JoinStore } from '../../store/join.store';

@Component({
  selector: 'sc-join',
  imports: [FormsModule, ButtonModule, InputOtpModule, MessageModule],
  template: `
    <div class="min-h-dvh flex items-center justify-center p-4">
      <div class="w-full max-w-sm flex flex-col gap-4 text-center">
        @if (store.info(); as invite) {
          <h1 class="text-2xl font-bold">{{ invite.name }}</h1>
          @if (invite.description) {
            <p class="opacity-70">{{ invite.description }}</p>
          }
          <p class="text-sm">Entrez votre code personnel pour rejoindre le groupe :</p>
          @if (store.error()) {
            <p-message severity="error" [text]="store.error()!" />
          }
          <form class="flex flex-col items-center gap-4" (ngSubmit)="join()">
            <p-inputotp
              name="code"
              [(ngModel)]="code"
              [length]="6"
              data-testid="join-code-input"
            />
            <p-button
              type="submit"
              label="Rejoindre"
              [loading]="store.loading()"
              [disabled]="code.length !== 6"
              styleClass="w-full"
              data-testid="join-submit"
            />
          </form>
        } @else if (store.notFound()) {
          <p-message severity="error" text="Invitation introuvable. Vérifiez le lien reçu." />
        } @else {
          <p class="opacity-70">Chargement…</p>
        }
      </div>
    </div>
  `,
})
export class JoinComponent implements OnInit {
  readonly store = inject(JoinStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  code = '';

  private get inviteToken(): string {
    return this.route.snapshot.paramMap.get('inviteToken') ?? '';
  }

  ngOnInit(): void {
    void this.store.loadInvite(this.inviteToken);
  }

  async join(): Promise<void> {
    try {
      const groupId = await this.store.join(this.inviteToken, this.code);
      void this.router.navigate(['/groups', groupId]);
    } catch {
      // l'erreur est exposée par store.error()
    }
  }
}
```

- [ ] **Step 3: Route `/join/:inviteToken`, vérifier, commit**

```bash
git add web
git commit -m "feat: add guest join flow with personal code entry"
```

---

### Task 7: Group shell — header, navigation, GroupStore

**Files:**
- Create: `web/src/app/store/group.store.ts`
- Create: `web/src/app/features/group/group-shell.component.ts`
- Test: `web/src/app/store/group.store.spec.ts`

- [ ] **Step 1: GroupStore (résumé + matchs + classement + stats) — test d'abord**

`web/src/app/store/group.store.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { GroupStore } from './group.store';
import { MatchView, Prediction } from '../core/models';

const match = (id: string, partial: Partial<MatchView> = {}): MatchView => ({
  id,
  groupId: 'g1',
  teamA: 'France',
  teamB: 'Brésil',
  kickoffAt: '2030-06-15T16:00:00.000Z',
  predictionDeadline: '2030-06-15T15:00:00.000Z',
  finalScoreA: null,
  finalScoreB: null,
  status: 'UPCOMING',
  myPrediction: null,
  predictions: [],
  ...partial,
});

describe('GroupStore', () => {
  const api = {
    groupSummary: vi.fn(),
    listMatches: vi.fn(),
    ranking: vi.fn(),
    groupStats: vi.fn(),
    submitPrediction: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api as unknown as ApiService }],
    });
  });

  it('loads matches for a group', async () => {
    api.listMatches.mockReturnValue(of([match('m1')]));
    const store = TestBed.inject(GroupStore);
    await store.loadMatches('g1');
    expect(store.matches().length).toBe(1);
  });

  it('applies optimistic prediction then reconciles with server response', async () => {
    api.listMatches.mockReturnValue(of([match('m1')]));
    const saved: Prediction = {
      id: 'pr1',
      matchId: 'm1',
      participantId: 'p1',
      scoreA: 2,
      scoreB: 1,
      editCount: 0,
      lockedAt: null,
      points: null,
    };
    api.submitPrediction.mockReturnValue(of(saved));
    const store = TestBed.inject(GroupStore);
    await store.loadMatches('g1');
    await store.submitPrediction('m1', 2, 1);
    expect(store.matches()[0].myPrediction?.scoreA).toBe(2);
    expect(store.matches()[0].myPrediction?.id).toBe('pr1');
  });

  it('rolls back the optimistic prediction on error', async () => {
    api.listMatches.mockReturnValue(of([match('m1')]));
    api.submitPrediction.mockReturnValue(throwError(() => new Error('403')));
    const store = TestBed.inject(GroupStore);
    await store.loadMatches('g1');
    await expect(store.submitPrediction('m1', 2, 1)).rejects.toThrow();
    expect(store.matches()[0].myPrediction).toBeNull();
  });
});
```

- [ ] **Step 2: Run (FAIL), implémenter**

`web/src/app/store/group.store.ts` :

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { GroupStats, GroupSummary, MatchView, Prediction, RankingEntry } from '../core/models';

interface GroupState {
  summary: GroupSummary | null;
  matches: MatchView[];
  ranking: RankingEntry[];
  stats: GroupStats | null;
  myStats: RankingEntry | null;
  loading: boolean;
  error: string | null;
}

const initialState: GroupState = {
  summary: null,
  matches: [],
  ranking: [],
  stats: null,
  myStats: null,
  loading: false,
  error: null,
};

export const GroupStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => ({
    reset(): void {
      patchState(store, initialState);
    },
    async loadSummary(groupId: string): Promise<void> {
      const summary = await firstValueFrom(api.groupSummary(groupId));
      patchState(store, { summary });
    },
    async loadMatches(groupId: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const matches = await firstValueFrom(api.listMatches(groupId));
        patchState(store, { matches, loading: false });
      } catch {
        patchState(store, { loading: false, error: 'Impossible de charger les matchs' });
      }
    },
    async loadRanking(groupId: string): Promise<void> {
      const ranking = await firstValueFrom(api.ranking(groupId));
      patchState(store, { ranking });
    },
    async loadStats(groupId: string): Promise<void> {
      const stats = await firstValueFrom(api.groupStats(groupId));
      patchState(store, { stats });
    },
    async loadMyStats(groupId: string, participantId: string): Promise<void> {
      const myStats = await firstValueFrom(api.participantStats(groupId, participantId));
      patchState(store, { myStats });
    },
    async submitPrediction(matchId: string, scoreA: number, scoreB: number): Promise<void> {
      const previous = store.matches();
      const optimistic = previous.map((m) =>
        m.id === matchId
          ? {
              ...m,
              myPrediction: {
                ...(m.myPrediction ?? {
                  id: 'optimistic',
                  matchId,
                  participantId: '',
                  editCount: 0,
                  lockedAt: null,
                  points: null,
                }),
                scoreA,
                scoreB,
              } as Prediction,
            }
          : m,
      );
      patchState(store, { matches: optimistic });
      try {
        const saved = await firstValueFrom(api.submitPrediction(matchId, scoreA, scoreB));
        patchState(store, {
          matches: store.matches().map((m) =>
            m.id === matchId ? { ...m, myPrediction: saved } : m,
          ),
        });
      } catch (error) {
        patchState(store, { matches: previous });
        throw error;
      }
    },
  })),
);
```

- [ ] **Step 3: GroupShellComponent**

Comportement : à l'activation, lit `:id`, pose `auth.activeGroupId`, `store.reset()`, charge le résumé. Header : nom du groupe, badge « Organisateur » si `summary.isOwner`. Navigation bas d'écran mobile (Matchs / Classement / Stats / + Admin si owner) via `routerLink` + `routerLinkActive`. Bouton copie du lien d'invitation visible owner (`navigator.clipboard.writeText(location.origin + '/join/' + inviteToken)` — l'inviteToken vient de `api.groupDetail` owner-only, charger seulement si owner ; pour le MVP shell, le lien de partage complet vit dans l'écran Admin, le header n'affiche que le nom + badge).

```typescript
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { GroupStore } from '../../store/group.store';

@Component({
  selector: 'sc-group-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-dvh flex flex-col">
      <header class="p-4 border-b flex items-center justify-between" data-testid="group-header">
        <div>
          <h1 class="font-bold text-lg">{{ store.summary()?.name ?? '…' }}</h1>
          @if (store.summary()?.isOwner) {
            <span class="text-xs rounded-full border px-2 py-0.5">Organisateur</span>
          }
        </div>
        <span class="text-sm opacity-70">
          {{ store.summary()?.participantCount ?? 0 }} joueurs
        </span>
      </header>

      <main class="flex-1 overflow-y-auto pb-20">
        <router-outlet />
      </main>

      <nav
        class="fixed bottom-0 inset-x-0 border-t bg-white flex justify-around py-2"
        data-testid="group-nav"
      >
        <a routerLink="matches" routerLinkActive="font-bold" class="flex flex-col items-center text-sm">
          <i class="pi pi-calendar"></i><span>Matchs</span>
        </a>
        <a routerLink="ranking" routerLinkActive="font-bold" class="flex flex-col items-center text-sm">
          <i class="pi pi-trophy"></i><span>Classement</span>
        </a>
        <a routerLink="stats" routerLinkActive="font-bold" class="flex flex-col items-center text-sm">
          <i class="pi pi-chart-bar"></i><span>Stats</span>
        </a>
        @if (store.summary()?.isOwner) {
          <a routerLink="admin" routerLinkActive="font-bold" class="flex flex-col items-center text-sm">
            <i class="pi pi-cog"></i><span>Admin</span>
          </a>
        }
      </nav>
    </div>
  `,
})
export class GroupShellComponent implements OnInit, OnDestroy {
  readonly store = inject(GroupStore);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const groupId = this.route.snapshot.paramMap.get('id') ?? '';
    this.auth.activeGroupId.set(groupId);
    this.store.reset();
    void this.store.loadSummary(groupId);
  }

  ngOnDestroy(): void {
    this.auth.activeGroupId.set(null);
  }
}
```

- [ ] **Step 4: Routes groupe (shell + enfants stubs pour les pages des tâches 8-11 créées au fur et à mesure), vérifier, commit**

```bash
git add web
git commit -m "feat: add group shell with summary header and mobile tab navigation"
```

---

### Task 8: Matchs — liste + carte match + compte à rebours

**Files:**
- Create: `web/src/app/shared/countdown.ts` + spec
- Create: `web/src/app/shared/match-card.component.ts`
- Create: `web/src/app/features/group/matches-page.component.ts`

- [ ] **Step 1: Utilitaire countdown — TDD**

`web/src/app/shared/countdown.spec.ts` :

```typescript
import { formatCountdown } from './countdown';

describe('formatCountdown', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('formats days and hours', () => {
    expect(formatCountdown(new Date('2026-06-17T15:30:00Z'), now)).toBe('2 j 3 h');
  });

  it('formats hours and minutes under a day', () => {
    expect(formatCountdown(new Date('2026-06-15T14:45:00Z'), now)).toBe('2 h 45 min');
  });

  it('formats minutes under an hour', () => {
    expect(formatCountdown(new Date('2026-06-15T12:20:00Z'), now)).toBe('20 min');
  });

  it('returns null when expired', () => {
    expect(formatCountdown(new Date('2026-06-15T11:59:00Z'), now)).toBeNull();
  });
});
```

`web/src/app/shared/countdown.ts` :

```typescript
export function formatCountdown(deadline: Date, now: Date = new Date()): string | null {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) {
    return null;
  }
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days} j ${hours % 24} h`;
  }
  if (hours > 0) {
    return `${hours} h ${minutes % 60} min`;
  }
  return `${minutes} min`;
}
```

- [ ] **Step 2: MatchCardComponent (présentation pure)**

`web/src/app/shared/match-card.component.ts` — inputs signal : `match: MatchView`, `canPredict: boolean` ; output : `predict` (ouvre l'éditeur, Task 9). Affiche : équipes, date (pipe `date:'EEE d MMM HH:mm':'':'fr'` — enregistrer la locale fr dans `app.config.ts` via `registerLocaleData(localeFr)` et `{ provide: LOCALE_ID, useValue: 'fr' }`), badge statut (`À venir` / `En cours` / `Terminé` avec couleurs), score final si terminé, mon pronostic + points gagnés si calculés, compte à rebours avant deadline (signal mis à jour par `interval` de 30 s via `toSignal`), état du droit d'édition (« 1 modification possible » si `editCount === 0` et pronostic existant, « Verrouillé » si `editCount >= 1` ou deadline passée), et après deadline la liste des pronostics des autres (`match.predictions`).

```typescript
import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map, startWith } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MatchView } from '../core/models';
import { formatCountdown } from './countdown';

const STATUS_LABEL: Record<string, { label: string; severity: 'info' | 'warn' | 'success' }> = {
  UPCOMING: { label: 'À venir', severity: 'info' },
  LIVE: { label: 'En cours', severity: 'warn' },
  FINISHED: { label: 'Terminé', severity: 'success' },
};

@Component({
  selector: 'sc-match-card',
  imports: [DatePipe, ButtonModule, TagModule],
  template: `
    <article class="rounded-xl border p-4 flex flex-col gap-3" data-testid="match-card">
      <div class="flex items-center justify-between">
        <p-tag
          [value]="statusInfo().label"
          [severity]="statusInfo().severity"
          data-testid="match-status"
        />
        <span class="text-sm opacity-70">{{ match().kickoffAt | date: 'EEE d MMM HH:mm' }}</span>
      </div>

      <div class="flex items-center justify-center gap-3 text-lg font-semibold">
        <span class="flex-1 text-right">{{ match().teamA }}</span>
        @if (match().status === 'FINISHED') {
          <span class="text-2xl tabular-nums" data-testid="final-score">
            {{ match().finalScoreA }} – {{ match().finalScoreB }}
          </span>
        } @else {
          <span class="opacity-40">vs</span>
        }
        <span class="flex-1">{{ match().teamB }}</span>
      </div>

      @if (match().myPrediction; as prediction) {
        <div class="text-center text-sm" data-testid="my-prediction">
          Mon pronostic : <strong>{{ prediction.scoreA }} – {{ prediction.scoreB }}</strong>
          @if (prediction.points !== null) {
            <span class="ml-2 font-bold">+{{ prediction.points }} pts</span>
          }
        </div>
      }

      @if (countdown(); as remaining) {
        <p class="text-center text-xs opacity-70" data-testid="countdown">
          Fin des pronostics dans {{ remaining }}
        </p>
      }

      @if (canPredict()) {
        <p-button
          [label]="match().myPrediction ? 'Modifier mon pronostic' : 'Pronostiquer'"
          styleClass="w-full"
          (onClick)="predict.emit()"
          data-testid="predict-button"
        />
        @if (match().myPrediction && match().myPrediction!.editCount === 0) {
          <p class="text-center text-xs opacity-70">1 modification possible</p>
        }
      } @else if (match().status !== 'FINISHED' && match().myPrediction) {
        <p class="text-center text-xs opacity-70">Pronostic verrouillé</p>
      }

      @if (match().predictions.length > 0) {
        <details class="text-sm">
          <summary class="cursor-pointer opacity-70">
            Pronostics du groupe ({{ match().predictions.length }})
          </summary>
          <ul class="mt-2 flex flex-col gap-1">
            @for (p of match().predictions; track p.id) {
              <li class="flex justify-between">
                <span>{{ p.participant?.name }}</span>
                <span class="tabular-nums">
                  {{ p.scoreA }} – {{ p.scoreB }}
                  @if (p.points !== null) {
                    <strong class="ml-1">+{{ p.points }}</strong>
                  }
                </span>
              </li>
            }
          </ul>
        </details>
      }
    </article>
  `,
})
export class MatchCardComponent {
  readonly match = input.required<MatchView>();
  readonly canPredict = input(false);
  readonly predict = output<void>();

  private readonly tick = toSignal(interval(30_000).pipe(startWith(0), map(() => Date.now())), {
    initialValue: Date.now(),
  });

  readonly statusInfo = computed(() => STATUS_LABEL[this.match().status]);
  readonly countdown = computed(() => {
    this.tick();
    if (this.match().status !== 'UPCOMING') {
      return null;
    }
    return formatCountdown(new Date(this.match().predictionDeadline));
  });
}
```

- [ ] **Step 3: MatchesPageComponent**

Charge `store.loadMatches(groupId)` (groupId via `inject(ActivatedRoute).parent`), calcule `canPredict(match)` = `status === 'UPCOMING'` && deadline future && `(!myPrediction || myPrediction.editCount === 0)`. Sections « À venir / En cours / Terminés » (`computed` de tri). Le clic `predict` ouvre l'éditeur (Task 9).

- [ ] **Step 4: Vérifier, commit**

```bash
git add web
git commit -m "feat: add match list with cards, status badges and countdown"
```

---

### Task 9: Saisie de pronostic — ScoreStepper + dialog d'édition

**Files:**
- Create: `web/src/app/shared/score-stepper.component.ts` + spec
- Create: `web/src/app/features/group/prediction-dialog.component.ts`
- Modify: `web/src/app/features/group/matches-page.component.ts`

- [ ] **Step 1: ScoreStepperComponent — TDD**

`web/src/app/shared/score-stepper.component.spec.ts` :

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScoreStepperComponent } from './score-stepper.component';

describe('ScoreStepperComponent', () => {
  let fixture: ComponentFixture<ScoreStepperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ScoreStepperComponent] }).compileComponents();
    fixture = TestBed.createComponent(ScoreStepperComponent);
    fixture.componentRef.setInput('label', 'France');
    fixture.detectChanges();
  });

  it('starts at 0 and increments', () => {
    const component = fixture.componentInstance;
    expect(component.value()).toBe(0);
    component.increment();
    expect(component.value()).toBe(1);
  });

  it('never goes below 0 nor above 99', () => {
    const component = fixture.componentInstance;
    component.decrement();
    expect(component.value()).toBe(0);
    component.value.set(99);
    component.increment();
    expect(component.value()).toBe(99);
  });
});
```

`web/src/app/shared/score-stepper.component.ts` :

```typescript
import { Component, input, model } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'sc-score-stepper',
  imports: [ButtonModule],
  template: `
    <div class="flex flex-col items-center gap-2" data-testid="score-stepper">
      <span class="font-semibold">{{ label() }}</span>
      <div class="flex items-center gap-3">
        <p-button
          icon="pi pi-minus"
          [rounded]="true"
          severity="secondary"
          (onClick)="decrement()"
          data-testid="stepper-minus"
        />
        <span class="text-3xl font-bold tabular-nums w-12 text-center" data-testid="stepper-value">
          {{ value() }}
        </span>
        <p-button
          icon="pi pi-plus"
          [rounded]="true"
          (onClick)="increment()"
          data-testid="stepper-plus"
        />
      </div>
    </div>
  `,
})
export class ScoreStepperComponent {
  readonly label = input.required<string>();
  readonly value = model(0);

  increment(): void {
    if (this.value() < 99) {
      this.value.update((v) => v + 1);
    }
  }

  decrement(): void {
    if (this.value() > 0) {
      this.value.update((v) => v - 1);
    }
  }
}
```

- [ ] **Step 2: PredictionDialogComponent**

Dialog PrimeNG : deux `sc-score-stepper` (équipe A / B) initialisés au pronostic existant ou 0-0, avertissement « Dernière modification possible ! » si `editCount === 0` et pronostic existant, bouton Valider → `groupStore.submitPrediction` (optimistic, rollback géré par le store) ; succès → toast (MessageService PrimeNG) « Pronostic enregistré ✔ » et fermeture ; erreur 403 → message « Pronostic verrouillé ou date limite dépassée » + rechargement des matchs.

- [ ] **Step 3: Brancher dans MatchesPage, vérifier, commit**

```bash
git add web
git commit -m "feat: add prediction entry with score steppers and optimistic update"
```

---

### Task 10: Classement + stats groupe + stats individuelles

**Files:**
- Create: `web/src/app/features/group/ranking-page.component.ts`
- Create: `web/src/app/features/group/stats-page.component.ts`

- [ ] **Step 1: RankingPageComponent**

Charge `store.loadRanking(groupId)`. Affiche :
- **Podium** (top 3) : trois colonnes (2e, 1er surélevé, 3e), nom + points, `data-testid="podium"`.
- **Tableau complet** : rang, nom, points, joués, corrects, exacts, % réussite (`p-table` PrimeNG, `responsiveLayout`). Surligne la ligne du participant courant (id depuis `auth.participantSession(groupId)?.participant.id`).

- [ ] **Step 2: StatsPageComponent**

Charge `store.loadStats(groupId)`. Cartes : nombre de participants, nombre de matchs, moyenne de points/joueur, meilleur joueur, plus de scores exacts. Si une session participant existe (`auth.participantSession(groupId)`) : `store.loadMyStats(groupId, participantId)` puis section « Mes statistiques » depuis `store.myStats()` (points, pronostiqués, exacts, bons vainqueurs, taux, moyenne, position). Aucun appel `ApiService` dans le composant.

- [ ] **Step 3: Vérifier, commit**

```bash
git add web
git commit -m "feat: add ranking podium, group stats and personal stats views"
```

---

### Task 11: Admin — AdminStore + participants, matchs, résultats, barème

**Files:**
- Create: `web/src/app/store/admin.store.ts`
- Create: `web/src/app/features/group-admin/admin-page.component.ts`
- Create: `web/src/app/features/group-admin/participants-panel.component.ts`
- Create: `web/src/app/features/group-admin/matches-panel.component.ts`
- Create: `web/src/app/features/group-admin/scoring-panel.component.ts`

- [ ] **Step 1: AdminStore (toutes les actions owner)**

`web/src/app/store/admin.store.ts` :

```typescript
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
```

- [ ] **Step 2: AdminPageComponent**

Garde locale : si `!groupStore.summary()?.isOwner` → redirection `matches`. Onglets PrimeNG (`p-tabs`) : Participants / Matchs / Barème. `ngOnInit` → `adminStore.reload(groupId)` (donne `inviteToken` + participants avec codes). Les panels enfants n'injectent que `AdminStore`/`GroupStore`.

- [ ] **Step 3: ParticipantsPanel (via AdminStore)**

- Encart lien d'invitation : `location.origin + '/join/' + adminStore.detail()?.inviteToken`, bouton « Copier le lien » (`navigator.clipboard`), toast confirmation.
- Liste `adminStore.detail()?.participants` : nom + code personnel (`<code>` monospace) + bouton copier le code + bouton supprimer (confirm dialog « Supprimer {name} ? Ses pronostics seront perdus. ») → `adminStore.removeParticipant`.
- Formulaire ajout : champ nom → `adminStore.addParticipant` ; erreur affichée via `adminStore.error()`.

- [ ] **Step 4: MatchesPanel (via AdminStore + GroupStore)**

- Formulaire création : équipes A/B (`pInputText`), date/heure du coup d'envoi et deadline (`p-datepicker` avec `showTime`, `dateFormat` fr) → conversion ISO → `adminStore.createMatch` ; erreur via `adminStore.error()`.
- Liste des matchs depuis `groupStore.matches()` avec statut ; matchs non terminés : bouton éditer (mêmes champs, `adminStore.updateMatch`).
- Matchs joués (kickoff passé) : formulaire score final (deux `p-inputnumber` 0-99) → `adminStore.setResult` ; après succès toast « Points calculés et classement mis à jour 🏆 ». Correction d'un résultat déjà saisi = re-soumission.

- [ ] **Step 5: ScoringPanel (via AdminStore)**

Trois `p-inputnumber` (score exact / bon vainqueur / bon score d'une équipe), pré-remplis depuis `adminStore.detail()`, bouton Enregistrer → `adminStore.updateScoring`. Note affichée : « Le nouveau barème s'applique aux prochains résultats saisis. »

- [ ] **Step 6: Vérifier, commit**

```bash
git add web
git commit -m "feat: add group admin panels (participants, matches, results, scoring)"
```

---

### Task 12: Passe design premium (skill frontend-design)

**REQUIRED SUB-SKILL à l'exécution :** invoquer le skill `frontend-design` pour cette tâche.

**Files:** tous les templates/styles de `web/src/` + `web/src/app/theme.ts` + `web/src/styles.css`

- [ ] **Step 1: Brief design (à donner au skill)**

- Identité : app de pronostics sportifs entre amis — énergique, conviviale, compétitive. Éviter le rendu « admin dashboard » et l'esthétique IA générique.
- Direction : palette personnalisée autour d'un vert terrain + accent vif (à la discrétion du designer), typographie display pour les scores (tabular-nums), thème PrimeNG enrichi via `definePreset` (`theme.ts`), dark mode via classe `.sc-dark` (toggle dans le header).
- Écrans clés à travailler : carte match (hiérarchie équipes/score, countdown urgent < 1 h), dialog pronostic (steppers tactiles généreux ≥ 44 px), podium animé du classement (entrée en scène), page join (première impression invité — la vendre comme une invitation, pas un formulaire), bottom nav mobile avec états actifs nets.
- Micro-interactions : confirmation de pronostic (animation), transitions de pages discrètes, skeletons de chargement au lieu de « Chargement… ».
- Mobile first irréprochable (360 px), desktop = composition centrée max-w confortable.

- [ ] **Step 2: Contraintes**

- INTERDIT de modifier : APIs des stores/services, signatures des composants (inputs/outputs), `data-testid`, logique métier, routes.
- Texte français, accents corrects, apostrophes typographiques.

- [ ] **Step 3: Vérifier après passe**

Run (dans `web/`): `npm test -- --no-watch` (tous verts — les tests ne ciblent que comportements et testids) + `npm run build` propre. Vérification visuelle via `make dev-web` + skill `verify`/navigation manuelle des parcours owner et invité.

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat: apply premium design pass (theme, dark mode, micro-interactions)"
```

---

### Task 13: Finitions — suite complète, versions, docs

**Files:**
- Modify: `README.md`, `web/package.json`, `api/package.json`

- [ ] **Step 1: Suite complète**

Run (racine): `make test` → unit API (16) + e2e API (92) + unit web tous verts. `make build` propre.

- [ ] **Step 2: Versions + README**

- `api/package.json` et `web/package.json` : version `0.1.0`.
- `README.md` : ajouter section frontend (make dev-web → http://localhost:4200, proxy API, parcours de démo : créer un compte → groupe → ajouter participants → partager `/join/<token>` + codes).

- [ ] **Step 3: Commit final**

```bash
git add README.md api/package.json web/package.json
git commit -m "chore: bump versions and document frontend workflow"
```

---

## Critères de fin du plan

- `make test` et `make build` entièrement verts (API 16 unit + 92 e2e ; web : stores, services, composants partagés).
- Parcours complets fonctionnels en local : organisateur (compte → groupe → participants → matchs → résultats → classement) et invité (lien → code → pronostic → classement).
- Design premium appliqué (Task 12) sans casser les contrats testés.
