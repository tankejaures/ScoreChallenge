# API-Football Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lier un groupe à une compétition officielle (API-Football) : import des matchs, scores live et règlement automatique des points, tout en conservant les groupes « libres » à saisie manuelle.

**Architecture:** Polling backend mutualisé : un module NestJS `football` parle seul à API-Football, met en cache les fixtures dans une table partagée `Fixture`, un cron règle automatiquement les matchs terminés. Le front Angular consomme uniquement notre API (wizard de création, sélecteur de matchs, affichage live avec polling 60 s).

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL (port 5435), `@nestjs/schedule` (nouveau), `fetch` natif Node (pas de nouvelle lib HTTP), Angular 21 + NgRx Signal Store + PrimeNG, tests Jest (api, e2e avec client mocké) et Vitest (web).

**Spec:** `docs/superpowers/specs/2026-06-12-football-api-integration-design.md`

**Conventions du repo:** single quotes, points-virgules, trailing commas, pas de `any`, messages utilisateur en français accentué. Commandes : `npm test` / `npm run test:e2e` dans `api/` (e2e nécessite `make db-test-create` une fois), tests web dans `web/` via `npm test`. Node masqué : préfixer les commandes web avec le PATH brew si nécessaire (cf. memory `scorechallenge-env-quirks`).

---

## Vue d'ensemble des fichiers

**Backend (api/) :**

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | + enum `FixtureStatus`, model `Fixture`, champs `Group.competition*`, `Match.fixtureId` |
| `src/football/football-api.types.ts` | Types des réponses API-Football + DTO domaine |
| `src/football/fixture-status.util.ts` | Mapping statut API (`NS`, `1H`, `FT`…) → `FixtureStatus` |
| `src/football/football-api.client.ts` | Seul service qui appelle API-Football (fetch + caches mémoire) |
| `src/football/football.service.ts` | Compétitions en cours, fixtures d'une compétition (upsert DB) |
| `src/football/football.controller.ts` | `GET /football/competitions`, `GET /football/competitions/:leagueId/fixtures` |
| `src/football/fixture-sync.service.ts` | Cron 60 s : poll des fixtures à surveiller, règlement auto |
| `src/football/football.module.ts` | Module + `ScheduleModule.forRoot()` |
| `src/matches/match-settlement.service.ts` | Logique partagée : score final → points (extrait de `setResult`) |
| `src/matches/dto/import-fixtures.dto.ts` | Body de `POST /groups/:groupId/matches/import` |
| `src/matches/matches.service.ts` | Garde-fous mode exclusif, import de fixtures, fixture dans `listForGroup` |
| `src/groups/dto/create-group.dto.ts` | Champ optionnel `competition` |
| `src/groups/groups.service.ts` | Persistance compétition + exposition dans `getSummary` |

**Frontend (web/) :**

| Fichier | Rôle |
|---|---|
| `src/app/core/models.ts` | `Competition`, `FixtureView`, extensions `Group`/`GroupSummary`/`MatchView` |
| `src/app/core/api.service.ts` | Nouveaux appels football + payload création groupe étendu |
| `src/app/store/football.store.ts` | Compétitions + fixtures pour le wizard/admin |
| `src/app/shared/fixture-picker.component.ts` | Sélecteur de matchs réutilisé (wizard + admin) |
| `src/app/features/dashboard/dashboard.component.ts` | Wizard 2 étapes de création de groupe |
| `src/app/features/group-admin/matches-panel.component.ts` | Mode compétition : ajout via picker, pas de saisie manuelle |
| `src/app/shared/match-card.component.ts` | Logos, score live, minute |
| `src/app/features/group/matches-page.component.ts` | Polling 60 s si match live + onglet visible |

---

### Task 1: Schéma Prisma — `Fixture`, `Group.competition*`, `Match.fixtureId`

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Step 1: Ajouter l'enum et le model `Fixture` en fin de schéma**

```prisma
enum FixtureStatus {
  SCHEDULED
  LIVE
  FINISHED
  POSTPONED
  CANCELLED
}

model Fixture {
  id         String        @id @default(cuid())
  externalId Int           @unique
  leagueId   Int
  season     Int
  round      String?
  teamA      String
  teamB      String
  teamALogo  String?
  teamBLogo  String?
  kickoffAt  DateTime
  status     FixtureStatus @default(SCHEDULED)
  minute     Int?
  scoreA     Int?
  scoreB     Int?
  updatedAt  DateTime      @updatedAt
  matches    Match[]

  @@index([leagueId, season])
}
```

- [ ] **Step 2: Étendre `Group` (après le champ `scoringOneTeamScore`)**

```prisma
  competitionLeagueId   Int?
  competitionSeason     Int?
  competitionName       String?
```

- [ ] **Step 3: Étendre `Match` (après le champ `predictionDeadline`)**

```prisma
  fixtureId          String?
  fixture            Fixture?     @relation(fields: [fixtureId], references: [id], onDelete: SetNull)
```

Et ajouter sous `@@index([groupId])` :

```prisma
  @@unique([groupId, fixtureId])
```

- [ ] **Step 4: Générer la migration et le client**

Run: `cd api && npx prisma migrate dev --name add_fixtures_and_competitions`
Expected: migration créée dans `api/prisma/migrations/`, `prisma generate` exécuté sans erreur.

- [ ] **Step 5: Vérifier que la suite existante passe toujours**

Run: `cd api && npm test`
Expected: PASS (aucun test ne touche les nouveaux champs).

- [ ] **Step 6: Commit**

```bash
git add api/prisma
git commit -m "feat(api): add Fixture model and competition fields to schema"
```

---

### Task 2: Dépendance `@nestjs/schedule` + variables d'environnement

**Files:**
- Modify: `api/package.json` (via npm install)
- Modify: `api/.env`, `api/.env.example`, `api/.env.test`

- [ ] **Step 1: Installer la dépendance**

Run: `cd api && npm install @nestjs/schedule`
Expected: ajout dans `dependencies` de `api/package.json`.

- [ ] **Step 2: Ajouter les variables d'env**

Dans `api/.env` et `api/.env.example` :

```bash
# API-Football (api-sports.io) — vide = synchronisation désactivée
FOOTBALL_API_KEY=
FOOTBALL_API_URL=https://v3.football.api-sports.io
```

Dans `api/.env.test` :

```bash
FOOTBALL_API_KEY=
FOOTBALL_API_URL=http://localhost:65535
```

(clé vide en test → le cron ne fait rien ; l'URL invalide garantit qu'aucun appel réseau réel ne part.)

- [ ] **Step 3: Commit**

```bash
git add api/package.json api/package-lock.json api/.env.example
git commit -m "chore(api): add @nestjs/schedule and football API env vars"
```

---

### Task 3: Mapping des statuts API-Football → `FixtureStatus`

**Files:**
- Create: `api/src/football/fixture-status.util.ts`
- Test: `api/src/football/fixture-status.util.spec.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
import { mapFixtureStatus } from './fixture-status.util';

describe('mapFixtureStatus', () => {
  it.each(['TBD', 'NS'])('maps %s to SCHEDULED', (short) => {
    expect(mapFixtureStatus(short)).toBe('SCHEDULED');
  });

  it.each(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])(
    'maps %s to LIVE',
    (short) => {
      expect(mapFixtureStatus(short)).toBe('LIVE');
    },
  );

  it.each(['FT', 'AET', 'PEN'])('maps %s to FINISHED', (short) => {
    expect(mapFixtureStatus(short)).toBe('FINISHED');
  });

  it('maps PST to POSTPONED', () => {
    expect(mapFixtureStatus('PST')).toBe('POSTPONED');
  });

  it.each(['CANC', 'ABD', 'AWD', 'WO'])('maps %s to CANCELLED', (short) => {
    expect(mapFixtureStatus(short)).toBe('CANCELLED');
  });

  it('falls back to SCHEDULED for unknown codes', () => {
    expect(mapFixtureStatus('???')).toBe('SCHEDULED');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd api && npx jest fixture-status --verbose`
Expected: FAIL — `Cannot find module './fixture-status.util'`.

- [ ] **Step 3: Implémenter**

```typescript
import { FixtureStatus } from '@prisma/client';

const STATUS_MAP: Record<string, FixtureStatus> = {
  TBD: 'SCHEDULED',
  NS: 'SCHEDULED',
  '1H': 'LIVE',
  HT: 'LIVE',
  '2H': 'LIVE',
  ET: 'LIVE',
  BT: 'LIVE',
  P: 'LIVE',
  SUSP: 'LIVE',
  INT: 'LIVE',
  LIVE: 'LIVE',
  FT: 'FINISHED',
  AET: 'FINISHED',
  PEN: 'FINISHED',
  PST: 'POSTPONED',
  CANC: 'CANCELLED',
  ABD: 'CANCELLED',
  AWD: 'CANCELLED',
  WO: 'CANCELLED',
};

export function mapFixtureStatus(short: string): FixtureStatus {
  return STATUS_MAP[short] ?? 'SCHEDULED';
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd api && npx jest fixture-status --verbose`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/football
git commit -m "feat(api): map API-Football status codes to FixtureStatus"
```

---

### Task 4: Types API-Football + `FootballApiClient`

**Files:**
- Create: `api/src/football/football-api.types.ts`
- Create: `api/src/football/football-api.client.ts`
- Test: `api/src/football/football-api.client.spec.ts`

- [ ] **Step 1: Créer les types (pas de test, déclarations pures)**

`api/src/football/football-api.types.ts` :

```typescript
// Réponses brutes API-Football v3 (champs utilisés uniquement)
export interface ApiFootballEnvelope<T> {
  response: T[];
}

export interface ApiLeagueEntry {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string };
  seasons: { year: number; current: boolean; start: string; end: string }[];
}

export interface ApiFixtureEntry {
  fixture: {
    id: number;
    date: string; // ISO
    status: { short: string; elapsed: number | null };
  };
  league: { id: number; season: number; round: string };
  teams: {
    home: { name: string; logo: string | null };
    away: { name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
}

// DTO domaine exposés par notre API
export interface CompetitionDto {
  leagueId: number;
  name: string;
  type: string;
  logo: string;
  country: string;
  season: number;
}
```

- [ ] **Step 2: Écrire le test du client qui échoue**

`api/src/football/football-api.client.spec.ts` :

```typescript
import { ConfigService } from '@nestjs/config';
import { FootballApiClient } from './football-api.client';
import { ApiLeagueEntry } from './football-api.types';

const leagueEntry: ApiLeagueEntry = {
  league: { id: 1, name: 'World Cup', type: 'Cup', logo: 'wc.png' },
  country: { name: 'World' },
  seasons: [{ year: 2026, current: true, start: '2026-06-11', end: '2026-07-19' }],
};

describe('FootballApiClient', () => {
  let client: FootballApiClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: [leagueEntry] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const config = {
      get: (key: string) =>
        key === 'FOOTBALL_API_KEY' ? 'test-key' : 'https://api.test',
    } as ConfigService;
    client = new FootballApiClient(config);
  });

  it('fetches current competitions with the API key header', async () => {
    const competitions = await client.getCurrentCompetitions();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/leagues?current=true',
      { headers: { 'x-apisports-key': 'test-key' } },
    );
    expect(competitions).toEqual([
      {
        leagueId: 1,
        name: 'World Cup',
        type: 'Cup',
        logo: 'wc.png',
        country: 'World',
        season: 2026,
      },
    ]);
  });

  it('caches competitions for subsequent calls', async () => {
    await client.getCurrentCompetitions();
    await client.getCurrentCompetitions();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the API responds with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 });
    await expect(client.getCurrentCompetitions()).rejects.toThrow(
      'API-Football error 429',
    );
  });

  it('chunks live fixture requests by 20 ids', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: [] }),
    });
    const ids = Array.from({ length: 25 }, (_, i) => i + 1);
    await client.getFixturesByIds(ids);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `https://api.test/fixtures?ids=${ids.slice(0, 20).join('-')}`,
      { headers: { 'x-apisports-key': 'test-key' } },
    );
  });
});
```

- [ ] **Step 3: Vérifier l'échec**

Run: `cd api && npx jest football-api.client --verbose`
Expected: FAIL — `Cannot find module './football-api.client'`.

- [ ] **Step 4: Implémenter le client**

`api/src/football/football-api.client.ts` :

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiFixtureEntry,
  ApiFootballEnvelope,
  ApiLeagueEntry,
  CompetitionDto,
} from './football-api.types';

const COMPETITIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FIXTURES_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_IDS_PER_REQUEST = 20;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class FootballApiClient {
  private competitionsCache: CacheEntry<CompetitionDto[]> | null = null;
  private readonly fixturesCache = new Map<string, CacheEntry<ApiFixtureEntry[]>>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('FOOTBALL_API_KEY'));
  }

  async getCurrentCompetitions(): Promise<CompetitionDto[]> {
    if (this.competitionsCache && this.competitionsCache.expiresAt > Date.now()) {
      return this.competitionsCache.value;
    }
    const entries = await this.request<ApiLeagueEntry>('/leagues?current=true');
    const competitions = entries
      .map((entry) => {
        const currentSeason = entry.seasons.find((s) => s.current);
        if (!currentSeason) {
          return null;
        }
        return {
          leagueId: entry.league.id,
          name: entry.league.name,
          type: entry.league.type,
          logo: entry.league.logo,
          country: entry.country.name,
          season: currentSeason.year,
        };
      })
      .filter((c): c is CompetitionDto => c !== null);
    this.competitionsCache = {
      value: competitions,
      expiresAt: Date.now() + COMPETITIONS_CACHE_TTL_MS,
    };
    return competitions;
  }

  async getFixtures(leagueId: number, season: number): Promise<ApiFixtureEntry[]> {
    const cacheKey = `${leagueId}:${season}`;
    const cached = this.fixturesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const fixtures = await this.request<ApiFixtureEntry>(
      `/fixtures?league=${leagueId}&season=${season}`,
    );
    this.fixturesCache.set(cacheKey, {
      value: fixtures,
      expiresAt: Date.now() + FIXTURES_CACHE_TTL_MS,
    });
    return fixtures;
  }

  // Pas de cache : appelé par le cron pour l'état live.
  async getFixturesByIds(externalIds: number[]): Promise<ApiFixtureEntry[]> {
    const results: ApiFixtureEntry[] = [];
    for (let i = 0; i < externalIds.length; i += MAX_IDS_PER_REQUEST) {
      const chunk = externalIds.slice(i, i + MAX_IDS_PER_REQUEST);
      results.push(
        ...(await this.request<ApiFixtureEntry>(`/fixtures?ids=${chunk.join('-')}`)),
      );
    }
    return results;
  }

  private async request<T>(path: string): Promise<T[]> {
    const baseUrl = this.config.get<string>('FOOTBALL_API_URL');
    const apiKey = this.config.get<string>('FOOTBALL_API_KEY');
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-apisports-key': apiKey ?? '' },
    });
    if (!response.ok) {
      throw new Error(`API-Football error ${response.status}`);
    }
    const body = (await response.json()) as ApiFootballEnvelope<T>;
    return body.response;
  }
}
```

- [ ] **Step 5: Vérifier le succès**

Run: `cd api && npx jest football-api.client --verbose`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/football
git commit -m "feat(api): add FootballApiClient with in-memory caching"
```

---

### Task 5: `FootballService` + `FootballController` + module

**Files:**
- Create: `api/src/football/football.service.ts`
- Create: `api/src/football/football.controller.ts`
- Create: `api/src/football/football.module.ts`
- Modify: `api/src/app.module.ts`
- Test: `api/test/football.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/football.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { FootballApiClient } from '../src/football/football-api.client';
import { ApiFixtureEntry, CompetitionDto } from '../src/football/football-api.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { registerOwner } from './groups.e2e-spec';
import { resetDb } from './test-utils';

export const WORLD_CUP: CompetitionDto = {
  leagueId: 1,
  name: 'World Cup',
  type: 'Cup',
  logo: 'wc.png',
  country: 'World',
  season: 2026,
};

export function fakeApiFixture(overrides: {
  id: number;
  status?: string;
  elapsed?: number | null;
  home?: number | null;
  away?: number | null;
}): ApiFixtureEntry {
  return {
    fixture: {
      id: overrides.id,
      date: '2026-06-15T16:00:00+00:00',
      status: {
        short: overrides.status ?? 'NS',
        elapsed: overrides.elapsed ?? null,
      },
    },
    league: { id: 1, season: 2026, round: 'Group A - 1' },
    teams: {
      home: { name: 'France', logo: 'fr.png' },
      away: { name: 'Brésil', logo: 'br.png' },
    },
    goals: { home: overrides.home ?? null, away: overrides.away ?? null },
  };
}

export const footballClientMock = {
  isConfigured: jest.fn().mockReturnValue(true),
  getCurrentCompetitions: jest.fn(),
  getFixtures: jest.fn(),
  getFixturesByIds: jest.fn(),
};

export async function createTestAppWithFootballMock(): Promise<
  INestApplication<App>
> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FootballApiClient)
    .useValue(footballClientMock)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app);
  await app.init();
  return app;
}

describe('Football (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    app = await createTestAppWithFootballMock();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    footballClientMock.isConfigured.mockReturnValue(true);
    await resetDb(app);
    token = await registerOwner(app);
  });

  afterAll(() => app.close());

  it('lists current competitions for an authenticated owner', async () => {
    footballClientMock.getCurrentCompetitions.mockResolvedValue([WORLD_CUP]);
    const res = await request(app.getHttpServer())
      .get('/football/competitions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([WORLD_CUP]);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/football/competitions').expect(401);
  });

  it('lists fixtures and upserts them in DB', async () => {
    footballClientMock.getFixtures.mockResolvedValue([fakeApiFixture({ id: 101 })]);
    const res = await request(app.getHttpServer())
      .get('/football/competitions/1/fixtures?season=2026')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const fixtures = res.body as { externalId: number; teamA: string }[];
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].teamA).toBe('France');

    const prisma = app.get(PrismaService);
    const stored = await prisma.fixture.findUnique({ where: { externalId: 101 } });
    expect(stored?.status).toBe('SCHEDULED');
    expect(stored?.round).toBe('Group A - 1');
  });

  it('returns 503 when the football API is not configured', async () => {
    footballClientMock.isConfigured.mockReturnValue(false);
    await request(app.getHttpServer())
      .get('/football/competitions')
      .set('Authorization', `Bearer ${token}`)
      .expect(503);
  });
});
```

Note : `resetDb` (Task 11 le complètera) doit aussi vider `fixture`. Le faire dès maintenant — dans `api/test/test-utils.ts`, ajouter `prisma.fixture.deleteMany(),` après `prisma.match.deleteMany(),` :

```typescript
  await prisma.$transaction([
    prisma.prediction.deleteMany(),
    prisma.match.deleteMany(),
    prisma.fixture.deleteMany(),
    prisma.participant.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.group.deleteMany(),
    prisma.user.deleteMany(),
  ]);
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd api && npm run test:e2e -- football`
Expected: FAIL — `Cannot find module '../src/football/football-api.client'` n'existe plus (créé en Task 4) → échec sur `football.service`/module manquants ou routes 404.

- [ ] **Step 3: Implémenter le service**

`api/src/football/football.service.ts` :

```typescript
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Fixture } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FootballApiClient } from './football-api.client';
import { ApiFixtureEntry, CompetitionDto } from './football-api.types';
import { mapFixtureStatus } from './fixture-status.util';

@Injectable()
export class FootballService {
  constructor(
    private readonly client: FootballApiClient,
    private readonly prisma: PrismaService,
  ) {}

  getCompetitions(): Promise<CompetitionDto[]> {
    this.assertConfigured();
    return this.client.getCurrentCompetitions();
  }

  async listFixtures(leagueId: number, season: number): Promise<Fixture[]> {
    this.assertConfigured();
    const entries = await this.client.getFixtures(leagueId, season);
    return Promise.all(entries.map((entry) => this.upsertFixture(entry)));
  }

  upsertFixture(entry: ApiFixtureEntry): Promise<Fixture> {
    const data = {
      leagueId: entry.league.id,
      season: entry.league.season,
      round: entry.league.round,
      teamA: entry.teams.home.name,
      teamB: entry.teams.away.name,
      teamALogo: entry.teams.home.logo,
      teamBLogo: entry.teams.away.logo,
      kickoffAt: new Date(entry.fixture.date),
      status: mapFixtureStatus(entry.fixture.status.short),
      minute: entry.fixture.status.elapsed,
      scoreA: entry.goals.home,
      scoreB: entry.goals.away,
    };
    return this.prisma.fixture.upsert({
      where: { externalId: entry.fixture.id },
      create: { externalId: entry.fixture.id, ...data },
      update: data,
    });
  }

  private assertConfigured(): void {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException(
        'API football non configurée (FOOTBALL_API_KEY manquante)',
      );
    }
  }
}
```

- [ ] **Step 4: Implémenter le contrôleur**

`api/src/football/football.controller.ts` :

```typescript
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OwnerRoleGuard } from '../auth/owner-role.guard';
import { FootballService } from './football.service';

@UseGuards(OwnerRoleGuard)
@Controller('football')
export class FootballController {
  constructor(private readonly footballService: FootballService) {}

  @Get('competitions')
  competitions() {
    return this.footballService.getCompetitions();
  }

  @Get('competitions/:leagueId/fixtures')
  fixtures(
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query('season', ParseIntPipe) season: number,
  ) {
    return this.footballService.listFixtures(leagueId, season);
  }
}
```

Vérifier comment `OwnerRoleGuard` est utilisé ailleurs (`api/src/auth/owner-role.guard.ts`, usage dans `groups.controller.ts`) ; si l'authentification passe par un autre guard global/local (ex. `JwtAuthGuard` + `OwnerRoleGuard`), reproduire exactement le même empilement de guards que `GET /groups`.

- [ ] **Step 5: Créer le module et l'enregistrer**

`api/src/football/football.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FootballApiClient } from './football-api.client';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [FootballController],
  providers: [FootballApiClient, FootballService],
  exports: [FootballApiClient, FootballService],
})
export class FootballModule {}
```

Dans `api/src/app.module.ts`, ajouter `FootballModule` aux imports :

```typescript
import { FootballModule } from './football/football.module';
// …
    MatchesModule,
    FootballModule,
```

- [ ] **Step 6: Vérifier le succès**

Run: `cd api && npm run test:e2e -- football`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add api/src api/test
git commit -m "feat(api): add football competitions and fixtures endpoints"
```

---

### Task 6: Création de groupe avec compétition

**Files:**
- Modify: `api/src/groups/dto/create-group.dto.ts`
- Modify: `api/src/groups/groups.service.ts`
- Test: `api/test/groups.e2e-spec.ts` (ajout de cas)

- [ ] **Step 1: Ajouter les cas e2e qui échouent**

Dans `api/test/groups.e2e-spec.ts`, ajouter en fin de `describe` existant :

```typescript
  it('creates a group linked to a competition', async () => {
    const token = await registerOwner(app);
    const res = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'CdM entre potes',
        competition: { leagueId: 1, season: 2026, name: 'World Cup' },
      })
      .expect(201);
    const body = res.body as {
      competitionLeagueId: number;
      competitionSeason: number;
      competitionName: string;
    };
    expect(body.competitionLeagueId).toBe(1);
    expect(body.competitionSeason).toBe(2026);
    expect(body.competitionName).toBe('World Cup');
  });

  it('exposes competition info in the summary', async () => {
    const token = await registerOwner(app);
    const created = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'CdM entre potes',
        competition: { leagueId: 1, season: 2026, name: 'World Cup' },
      })
      .expect(201);
    const groupId = (created.body as { id: string }).id;
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const summary = res.body as { competitionLeagueId: number | null };
    expect(summary.competitionLeagueId).toBe(1);
  });
```

(Adapter `registerOwner`/`beforeEach` au style exact du fichier existant — le lire avant de modifier.)

- [ ] **Step 2: Vérifier l'échec**

Run: `cd api && npm run test:e2e -- groups`
Expected: FAIL — `competition` rejeté par la whitelist de validation (400) ou champs absents de la réponse.

- [ ] **Step 3: Étendre le DTO**

`api/src/groups/dto/create-group.dto.ts` :

```typescript
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompetitionRefDto {
  @IsInt()
  leagueId: number;

  @IsInt()
  season: number;

  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}

export class CreateGroupDto {
  // … champs existants inchangés …

  @IsOptional()
  @ValidateNested()
  @Type(() => CompetitionRefDto)
  competition?: CompetitionRefDto;
}
```

- [ ] **Step 4: Étendre `GroupsService.create` et `getSummary`**

Dans `api/src/groups/groups.service.ts`, remplacer le `tx.group.create` :

```typescript
      const { competition, ...groupData } = dto;
      const group = await tx.group.create({
        data: {
          ...groupData,
          ownerId,
          inviteToken: generateInviteToken(),
          competitionLeagueId: competition?.leagueId ?? null,
          competitionSeason: competition?.season ?? null,
          competitionName: competition?.name ?? null,
        },
      });
```

Dans `getSummary`, ajouter au retour :

```typescript
      competitionLeagueId: group.competitionLeagueId,
      competitionSeason: group.competitionSeason,
      competitionName: group.competitionName,
```

- [ ] **Step 5: Vérifier le succès + non-régression**

Run: `cd api && npm run test:e2e -- groups && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src api/test
git commit -m "feat(api): link groups to a competition at creation"
```

---

### Task 7: Extraction de `MatchSettlementService`

Refactor pur : la logique « score final → mise à jour du match + calcul des points » sort de `MatchesService.setResult` pour être réutilisée par le cron (Task 10). Aucun changement de comportement.

**Files:**
- Create: `api/src/matches/match-settlement.service.ts`
- Modify: `api/src/matches/matches.service.ts`
- Modify: `api/src/matches/matches.module.ts`

- [ ] **Step 1: Créer le service**

`api/src/matches/match-settlement.service.ts` :

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { Match } from '@prisma/client';
import { ScoringService } from '../predictions/scoring.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
  ) {}

  // Enregistre le score final d'un match et recalcule les points
  // de tous les pronostics associés, dans une transaction.
  async settle(matchId: string, scoreA: number, scoreB: number): Promise<Match> {
    const existing = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { group: true },
    });
    if (!existing) {
      throw new NotFoundException('Match introuvable');
    }
    const config = {
      exactScore: existing.group.scoringExactScore,
      correctOutcome: existing.group.scoringCorrectOutcome,
      oneTeamScore: existing.group.scoringOneTeamScore,
    };
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.match.update({
        where: { id: matchId },
        data: { finalScoreA: scoreA, finalScoreB: scoreB },
      });
      const predictions = await tx.prediction.findMany({ where: { matchId } });
      for (const prediction of predictions) {
        const points = this.scoringService.computePoints(
          { a: prediction.scoreA, b: prediction.scoreB },
          { a: scoreA, b: scoreB },
          config,
        );
        await tx.prediction.update({
          where: { id: prediction.id },
          data: { points },
        });
      }
      return match;
    });
  }
}
```

- [ ] **Step 2: Refactorer `MatchesService.setResult`**

Dans `api/src/matches/matches.service.ts` : injecter `MatchSettlementService` dans le constructeur, remplacer le corps de `setResult` :

```typescript
  async setResult(groupId: string, matchId: string, dto: SetResultDto) {
    await this.findInGroup(groupId, matchId);
    const updated = await this.settlementService.settle(
      matchId,
      dto.scoreA,
      dto.scoreB,
    );
    return this.withStatus(updated);
  }
```

Supprimer l'import de `ScoringService` devenu inutile dans `matches.service.ts` (le retirer aussi du constructeur).

- [ ] **Step 3: Enregistrer le provider**

Dans `api/src/matches/matches.module.ts`, ajouter `MatchSettlementService` aux `providers` et aux `exports` (le module football l'utilisera en Task 10).

- [ ] **Step 4: Vérifier la non-régression**

Run: `cd api && npm test && npm run test:e2e -- results`
Expected: PASS — `results.e2e-spec.ts` couvre déjà le calcul des points via `setResult`.

- [ ] **Step 5: Commit**

```bash
git add api/src
git commit -m "refactor(api): extract MatchSettlementService from MatchesService"
```

---

### Task 8: Garde-fous du mode exclusif + import de fixtures

**Files:**
- Create: `api/src/matches/dto/import-fixtures.dto.ts`
- Modify: `api/src/matches/matches.service.ts`
- Modify: `api/src/matches/matches.controller.ts`
- Test: `api/test/match-import.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/match-import.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { FUTURE_DEADLINE, FUTURE_KICKOFF } from './matches.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

async function createCompetitionGroup(
  app: INestApplication<App>,
  token: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/groups')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'CdM',
      competition: { leagueId: 1, season: 2026, name: 'World Cup' },
    })
    .expect(201);
  return (res.body as { id: string }).id;
}

async function seedFixture(
  app: INestApplication<App>,
  externalId: number,
  leagueId = 1,
  season = 2026,
): Promise<string> {
  const prisma = app.get(PrismaService);
  const fixture = await prisma.fixture.create({
    data: {
      externalId,
      leagueId,
      season,
      round: 'Group A - 1',
      teamA: 'France',
      teamB: 'Brésil',
      kickoffAt: new Date(FUTURE_KICKOFF),
    },
  });
  return fixture.id;
}

describe('Match import (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    token = await registerOwner(app);
  });

  afterAll(() => app.close());

  it('imports fixtures as group matches with deadline = kickoff', async () => {
    const groupId = await createCompetitionGroup(app, token);
    const fixtureId = await seedFixture(app, 101);
    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    const matches = res.body as {
      teamA: string;
      kickoffAt: string;
      predictionDeadline: string;
      fixtureId: string;
    }[];
    expect(matches).toHaveLength(1);
    expect(matches[0].teamA).toBe('France');
    expect(matches[0].fixtureId).toBe(fixtureId);
    expect(matches[0].predictionDeadline).toBe(matches[0].kickoffAt);
  });

  it('skips fixtures already imported', async () => {
    const groupId = await createCompetitionGroup(app, token);
    const fixtureId = await seedFixture(app, 101);
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    expect(res.body).toHaveLength(0);
  });

  it('rejects fixtures from another competition', async () => {
    const groupId = await createCompetitionGroup(app, token);
    const otherLeagueFixture = await seedFixture(app, 202, 39, 2026);
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [otherLeagueFixture] })
      .expect(400);
  });

  it('rejects import into a free-mode group', async () => {
    const res = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Libre' })
      .expect(201);
    const freeGroupId = (res.body as { id: string }).id;
    const fixtureId = await seedFixture(app, 101);
    await request(app.getHttpServer())
      .post(`/groups/${freeGroupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(400);
  });

  it('rejects manual match creation in a competition group', async () => {
    const groupId = await createCompetitionGroup(app, token);
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: FUTURE_KICKOFF,
        predictionDeadline: FUTURE_DEADLINE,
      })
      .expect(400);
  });

  it('rejects manual result entry on a fixture-linked match', async () => {
    const groupId = await createCompetitionGroup(app, token);
    const fixtureId = await seedFixture(app, 101);
    const imported = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    const matchId = (imported.body as { id: string }[])[0].id;
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 1, scoreB: 0 })
      .expect(400);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd api && npm run test:e2e -- match-import`
Expected: FAIL — route `/import` inexistante (404), garde-fous absents.

- [ ] **Step 3: Créer le DTO**

`api/src/matches/dto/import-fixtures.dto.ts` :

```typescript
import { ArrayMaxSize, ArrayNotEmpty, IsString } from 'class-validator';

export class ImportFixturesDto {
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  fixtureIds: string[];
}
```

- [ ] **Step 4: Implémenter dans `MatchesService`**

Ajouter dans `api/src/matches/matches.service.ts` :

```typescript
  async importFixtures(groupId: string, dto: ImportFixturesDto) {
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
    });
    if (group.competitionLeagueId === null) {
      throw new BadRequestException(
        'Ce groupe n’est pas lié à une compétition : créez les matchs manuellement',
      );
    }
    const fixtures = await this.prisma.fixture.findMany({
      where: { id: { in: dto.fixtureIds } },
    });
    if (fixtures.length !== dto.fixtureIds.length) {
      throw new BadRequestException('Certains matchs sont introuvables');
    }
    const foreign = fixtures.find(
      (f) =>
        f.leagueId !== group.competitionLeagueId ||
        f.season !== group.competitionSeason,
    );
    if (foreign) {
      throw new BadRequestException(
        'Certains matchs n’appartiennent pas à la compétition du groupe',
      );
    }
    const existing = await this.prisma.match.findMany({
      where: { groupId, fixtureId: { in: dto.fixtureIds } },
      select: { fixtureId: true },
    });
    const alreadyImported = new Set(existing.map((m) => m.fixtureId));
    const toCreate = fixtures.filter((f) => !alreadyImported.has(f.id));
    const created = await this.prisma.$transaction(
      toCreate.map((fixture) =>
        this.prisma.match.create({
          data: {
            groupId,
            fixtureId: fixture.id,
            teamA: fixture.teamA,
            teamB: fixture.teamB,
            kickoffAt: fixture.kickoffAt,
            predictionDeadline: fixture.kickoffAt,
          },
        }),
      ),
    );
    return created.map((match) => this.withStatus(match));
  }
```

Importer `ImportFixturesDto` en tête de fichier.

- [ ] **Step 5: Ajouter les garde-fous**

Dans `MatchesService.create`, en tête de méthode :

```typescript
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
    });
    if (group.competitionLeagueId !== null) {
      throw new BadRequestException(
        'Ce groupe est lié à une compétition : importez les matchs officiels',
      );
    }
```

Dans `MatchesService.setResult`, après `findInGroup` (qui retourne le match) :

```typescript
  async setResult(groupId: string, matchId: string, dto: SetResultDto) {
    const match = await this.findInGroup(groupId, matchId);
    if (match.fixtureId !== null) {
      throw new BadRequestException(
        'Score géré automatiquement pour les matchs officiels',
      );
    }
    const updated = await this.settlementService.settle(
      matchId,
      dto.scoreA,
      dto.scoreB,
    );
    return this.withStatus(updated);
  }
```

- [ ] **Step 6: Ajouter la route**

Dans `api/src/matches/matches.controller.ts` :

```typescript
  @UseGuards(GroupOwnerGuard)
  @Post('import')
  importFixtures(
    @Param('groupId') groupId: string,
    @Body() dto: ImportFixturesDto,
  ) {
    return this.matchesService.importFixtures(groupId, dto);
  }
```

Attention : la route `@Post('import')` doit être déclarée AVANT `@Post(':mid/result')` n'entre pas en conflit, mais `@Patch(':mid')` matcherait `import` sur PATCH seulement — pas de conflit en POST. Placer quand même `import` juste après le `@Post()` de création pour la lisibilité.

- [ ] **Step 7: Vérifier le succès + non-régression**

Run: `cd api && npm run test:e2e -- match-import && npm run test:e2e -- matches && npm run test:e2e -- results`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/src api/test
git commit -m "feat(api): import competition fixtures and enforce exclusive group modes"
```

---

### Task 9: Données live dans `listForGroup`

**Files:**
- Modify: `api/src/matches/matches.service.ts:92-118` (méthode `listForGroup`)
- Test: `api/test/match-list.e2e-spec.ts` (ajout d'un cas)

- [ ] **Step 1: Ajouter le cas e2e qui échoue**

Dans `api/test/match-list.e2e-spec.ts` (lire d'abord le fichier, reprendre son setup), ajouter :

```typescript
  it('exposes live fixture data on imported matches', async () => {
    // Créer groupe compétition + fixture en DB (mêmes helpers que match-import.e2e-spec)
    const prisma = app.get(PrismaService);
    const fixture = await prisma.fixture.create({
      data: {
        externalId: 555,
        leagueId: 1,
        season: 2026,
        round: 'Group A - 1',
        teamA: 'France',
        teamB: 'Brésil',
        teamALogo: 'fr.png',
        teamBLogo: 'br.png',
        kickoffAt: new Date(),
        status: 'LIVE',
        minute: 37,
        scoreA: 1,
        scoreB: 0,
      },
    });
    await prisma.match.create({
      data: {
        groupId: competitionGroupId,
        fixtureId: fixture.id,
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: fixture.kickoffAt,
        predictionDeadline: fixture.kickoffAt,
      },
    });
    const res = await request(app.getHttpServer())
      .get(`/groups/${competitionGroupId}/matches`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const match = (res.body as {
      fixture: { status: string; minute: number; scoreA: number } | null;
    }[])[0];
    expect(match.fixture).toMatchObject({ status: 'LIVE', minute: 37, scoreA: 1 });
  });
```

(`competitionGroupId` : créer dans le test un groupe avec `competition { leagueId: 1, season: 2026, name: 'World Cup' }`, comme en Task 8.)

- [ ] **Step 2: Vérifier l'échec**

Run: `cd api && npm run test:e2e -- match-list`
Expected: FAIL — `match.fixture` est `undefined`.

- [ ] **Step 3: Inclure la fixture dans la requête**

Dans `listForGroup`, étendre l'`include` :

```typescript
      include: {
        fixture: {
          select: {
            status: true,
            minute: true,
            scoreA: true,
            scoreB: true,
            teamALogo: true,
            teamBLogo: true,
            round: true,
          },
        },
        predictions: {
          include: { participant: { select: { id: true, name: true } } },
        },
      },
```

La fixture est alors présente dans le spread `...rest` du map — rien d'autre à changer (les matchs manuels auront `fixture: null`).

- [ ] **Step 4: Vérifier le succès**

Run: `cd api && npm run test:e2e -- match-list`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src api/test
git commit -m "feat(api): expose live fixture data in group match list"
```

---

### Task 10: `FixtureSyncService` — cron de synchronisation et règlement auto

**Files:**
- Create: `api/src/football/fixture-sync.service.ts`
- Modify: `api/src/football/football.module.ts`
- Test: `api/test/fixture-sync.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/fixture-sync.e2e-spec.ts` — utilise l'app avec client mocké (helpers exportés par `football.e2e-spec.ts`) :

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { FixtureSyncService } from '../src/football/fixture-sync.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestAppWithFootballMock,
  fakeApiFixture,
  footballClientMock,
} from './football.e2e-spec';
import { registerOwner } from './groups.e2e-spec';
import { resetDb } from './test-utils';

describe('FixtureSync (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sync: FixtureSyncService;
  let token: string;
  let groupId: string;
  let fixtureId: string;
  let matchId: string;
  let participantToken: string;

  beforeAll(async () => {
    app = await createTestAppWithFootballMock();
    prisma = app.get(PrismaService);
    sync = app.get(FixtureSyncService);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    footballClientMock.isConfigured.mockReturnValue(true);
    await resetDb(app);
    token = await registerOwner(app);

    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'CdM',
        competition: { leagueId: 1, season: 2026, name: 'World Cup' },
      })
      .expect(201);
    groupId = (groupRes.body as { id: string }).id;

    // Fixture dont le coup d'envoi vient de passer (dans la fenêtre de surveillance)
    const fixture = await prisma.fixture.create({
      data: {
        externalId: 777,
        leagueId: 1,
        season: 2026,
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: new Date(Date.now() - 60 * 1000),
        status: 'SCHEDULED',
      },
    });
    fixtureId = fixture.id;

    const importRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    matchId = (importRes.body as { id: string }[])[0].id;
  });

  afterAll(() => app.close());

  it('updates live score and minute from the API', async () => {
    footballClientMock.getFixturesByIds.mockResolvedValue([
      fakeApiFixture({ id: 777, status: '1H', elapsed: 23, home: 1, away: 0 }),
    ]);
    await sync.sync();
    expect(footballClientMock.getFixturesByIds).toHaveBeenCalledWith([777]);
    const fixture = await prisma.fixture.findUniqueOrThrow({
      where: { id: fixtureId },
    });
    expect(fixture.status).toBe('LIVE');
    expect(fixture.minute).toBe(23);
    expect(fixture.scoreA).toBe(1);
  });

  it('settles linked matches when the fixture finishes', async () => {
    // Le propriétaire (participant auto-créé) pronostique 2-0 avant la deadline ?
    // Deadline = kickoff (passé) → insérer le pronostic directement en DB.
    const participant = await prisma.participant.findFirstOrThrow({
      where: { groupId },
    });
    await prisma.prediction.create({
      data: { matchId, participantId: participant.id, scoreA: 2, scoreB: 0 },
    });

    footballClientMock.getFixturesByIds.mockResolvedValue([
      fakeApiFixture({ id: 777, status: 'FT', elapsed: 90, home: 2, away: 0 }),
    ]);
    await sync.sync();

    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.finalScoreA).toBe(2);
    expect(match.finalScoreB).toBe(0);
    const prediction = await prisma.prediction.findFirstOrThrow({
      where: { matchId },
    });
    expect(prediction.points).toBe(5); // score exact, barème par défaut
  });

  it('does nothing when no fixture is in the watch window', async () => {
    await prisma.fixture.update({
      where: { id: fixtureId },
      data: { kickoffAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await sync.sync();
    expect(footballClientMock.getFixturesByIds).not.toHaveBeenCalled();
  });

  it('does nothing when the API key is missing', async () => {
    footballClientMock.isConfigured.mockReturnValue(false);
    await sync.sync();
    expect(footballClientMock.getFixturesByIds).not.toHaveBeenCalled();
  });

  it('survives an API failure and keeps DB data intact', async () => {
    footballClientMock.getFixturesByIds.mockRejectedValue(new Error('quota'));
    await expect(sync.sync()).resolves.toBeUndefined();
    const fixture = await prisma.fixture.findUniqueOrThrow({
      where: { id: fixtureId },
    });
    expect(fixture.status).toBe('SCHEDULED');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd api && npm run test:e2e -- fixture-sync`
Expected: FAIL — `FixtureSyncService` inexistant.

- [ ] **Step 3: Implémenter**

`api/src/football/fixture-sync.service.ts` :

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchSettlementService } from '../matches/match-settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { FootballApiClient } from './football-api.client';
import { FootballService } from './football.service';
import { mapFixtureStatus } from './fixture-status.util';

const WATCH_BEFORE_KICKOFF_MS = 5 * 60 * 1000;
const WATCH_AFTER_KICKOFF_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class FixtureSyncService {
  private readonly logger = new Logger(FixtureSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: FootballApiClient,
    private readonly footballService: FootballService,
    private readonly settlementService: MatchSettlementService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sync(): Promise<void> {
    if (!this.client.isConfigured()) {
      return;
    }
    const now = Date.now();
    const watched = await this.prisma.fixture.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        kickoffAt: {
          gte: new Date(now - WATCH_AFTER_KICKOFF_MS),
          lte: new Date(now + WATCH_BEFORE_KICKOFF_MS),
        },
        matches: { some: {} },
      },
    });
    if (watched.length === 0) {
      return;
    }
    try {
      const entries = await this.client.getFixturesByIds(
        watched.map((f) => f.externalId),
      );
      for (const entry of entries) {
        const previous = watched.find((f) => f.externalId === entry.fixture.id);
        if (!previous) {
          continue;
        }
        const updated = await this.footballService.upsertFixture(entry);
        const justFinished =
          previous.status !== 'FINISHED' &&
          mapFixtureStatus(entry.fixture.status.short) === 'FINISHED';
        if (justFinished && updated.scoreA !== null && updated.scoreB !== null) {
          await this.settleLinkedMatches(updated.id, updated.scoreA, updated.scoreB);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Synchronisation API-Football échouée : ${(error as Error).message}`,
      );
    }
  }

  private async settleLinkedMatches(
    fixtureId: string,
    scoreA: number,
    scoreB: number,
  ): Promise<void> {
    const matches = await this.prisma.match.findMany({
      where: { fixtureId, finalScoreA: null },
      select: { id: true },
    });
    for (const match of matches) {
      await this.settlementService.settle(match.id, scoreA, scoreB);
    }
    if (matches.length > 0) {
      this.logger.log(
        `Fixture ${fixtureId} terminée : ${matches.length} match(s) réglé(s) automatiquement`,
      );
    }
  }
}
```

- [ ] **Step 4: Enregistrer dans le module**

`api/src/football/football.module.ts` : importer `MatchesModule` et ajouter `FixtureSyncService` :

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchesModule } from '../matches/matches.module';
import { FixtureSyncService } from './fixture-sync.service';
import { FootballApiClient } from './football-api.client';
import { FootballController } from './football.controller';
import { FootballService } from './football.service';

@Module({
  imports: [ScheduleModule.forRoot(), MatchesModule],
  controllers: [FootballController],
  providers: [FootballApiClient, FootballService, FixtureSyncService],
  exports: [FootballApiClient, FootballService],
})
export class FootballModule {}
```

(Si `MatchesModule` n'exporte pas encore `MatchSettlementService`, vérifier Task 7 Step 3.)

- [ ] **Step 5: Vérifier le succès + suite complète**

Run: `cd api && npm run test:e2e && npm test`
Expected: PASS — toute la suite.

- [ ] **Step 6: Commit**

```bash
git add api/src api/test
git commit -m "feat(api): sync live fixtures and auto-settle finished matches"
```

---

### Task 11: Web — modèles et `ApiService`

**Files:**
- Modify: `web/src/app/core/models.ts`
- Modify: `web/src/app/core/api.service.ts`

- [ ] **Step 1: Étendre les modèles**

Dans `web/src/app/core/models.ts`, ajouter :

```typescript
export type FixtureStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';

export interface Competition {
  leagueId: number;
  name: string;
  type: string;
  logo: string;
  country: string;
  season: number;
}

export interface FixtureView {
  id: string;
  externalId: number;
  leagueId: number;
  season: number;
  round: string | null;
  teamA: string;
  teamB: string;
  teamALogo: string | null;
  teamBLogo: string | null;
  kickoffAt: string;
  status: FixtureStatus;
  minute: number | null;
  scoreA: number | null;
  scoreB: number | null;
}

export interface MatchFixtureInfo {
  status: FixtureStatus;
  minute: number | null;
  scoreA: number | null;
  scoreB: number | null;
  teamALogo: string | null;
  teamBLogo: string | null;
  round: string | null;
}
```

Étendre les interfaces existantes :
- `Group` : `competitionLeagueId: number | null; competitionSeason: number | null; competitionName: string | null;`
- `GroupSummary` : mêmes trois champs.
- `MatchView` : `fixtureId: string | null; fixture: MatchFixtureInfo | null;`

Mettre à jour les fabriques de test impactées (`fakeGroup` dans `web/src/app/store/groups.store.spec.ts`, mocks éventuels dans `group.store.spec.ts`) avec les nouveaux champs à `null`.

- [ ] **Step 2: Étendre `ApiService`**

Dans `web/src/app/core/api.service.ts` :

```typescript
export interface CreateGroupPayload {
  name: string;
  description?: string;
  scoringExactScore?: number;
  scoringCorrectOutcome?: number;
  scoringOneTeamScore?: number;
  competition?: { leagueId: number; season: number; name: string };
}
```

Et les méthodes (section `// Football` après `// Matches`) :

```typescript
  // Football
  footballCompetitions(): Observable<Competition[]> {
    return this.http.get<Competition[]>(`${BASE}/football/competitions`);
  }
  competitionFixtures(leagueId: number, season: number): Observable<FixtureView[]> {
    return this.http.get<FixtureView[]>(
      `${BASE}/football/competitions/${leagueId}/fixtures?season=${season}`,
    );
  }
  importMatches(groupId: string, fixtureIds: string[]): Observable<MatchView[]> {
    return this.http.post<MatchView[]>(`${BASE}/groups/${groupId}/matches/import`, {
      fixtureIds,
    });
  }
```

(Ajouter `Competition` et `FixtureView` à l'import depuis `./models`.)

- [ ] **Step 3: Vérifier compilation + tests web**

Run: `cd web && npm test`
Expected: PASS (les specs mises à jour compilent).

- [ ] **Step 4: Commit**

```bash
git add web/src
git commit -m "feat(web): add football models and API methods"
```

---

### Task 12: Web — `FootballStore`

**Files:**
- Create: `web/src/app/store/football.store.ts`
- Test: `web/src/app/store/football.store.spec.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApiService } from '../core/api.service';
import { Competition, FixtureView } from '../core/models';
import { FootballStore } from './football.store';

const worldCup: Competition = {
  leagueId: 1,
  name: 'World Cup',
  type: 'Cup',
  logo: 'wc.png',
  country: 'World',
  season: 2026,
};

const fixture = (id: string, round: string): FixtureView => ({
  id,
  externalId: 1,
  leagueId: 1,
  season: 2026,
  round,
  teamA: 'France',
  teamB: 'Brésil',
  teamALogo: null,
  teamBLogo: null,
  kickoffAt: new Date().toISOString(),
  status: 'SCHEDULED',
  minute: null,
  scoreA: null,
  scoreB: null,
});

describe('FootballStore', () => {
  const api = {
    footballCompetitions: vi.fn(),
    competitionFixtures: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api as unknown as ApiService }],
    });
  });

  it('loads competitions', async () => {
    api.footballCompetitions.mockReturnValue(of([worldCup]));
    const store = TestBed.inject(FootballStore);
    await store.loadCompetitions();
    expect(store.competitions()).toEqual([worldCup]);
    expect(store.loading()).toBe(false);
  });

  it('loads fixtures for a competition', async () => {
    api.competitionFixtures.mockReturnValue(of([fixture('f1', 'Group A - 1')]));
    const store = TestBed.inject(FootballStore);
    await store.loadFixtures(1, 2026);
    expect(store.fixtures().length).toBe(1);
  });

  it('exposes an error when the API is unavailable', async () => {
    api.footballCompetitions.mockReturnValue(throwError(() => new Error('503')));
    const store = TestBed.inject(FootballStore);
    await store.loadCompetitions();
    expect(store.error()).toBe('Compétitions indisponibles pour le moment');
  });
});
```

(Import en tête du fichier : `import { of, throwError } from 'rxjs';`.)

- [ ] **Step 2: Vérifier l'échec**

Run: `cd web && npm test -- football.store`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Implémenter**

`web/src/app/store/football.store.ts` :

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Competition, FixtureView } from '../core/models';

interface FootballState {
  competitions: Competition[];
  fixtures: FixtureView[];
  loading: boolean;
  error: string | null;
}

const initialState: FootballState = {
  competitions: [],
  fixtures: [],
  loading: false,
  error: null,
};

export const FootballStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => ({
    async loadCompetitions(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const competitions = await firstValueFrom(api.footballCompetitions());
        patchState(store, { competitions, loading: false });
      } catch {
        patchState(store, {
          loading: false,
          error: 'Compétitions indisponibles pour le moment',
        });
      }
    },
    async loadFixtures(leagueId: number, season: number): Promise<void> {
      patchState(store, { loading: true, error: null, fixtures: [] });
      try {
        const fixtures = await firstValueFrom(api.competitionFixtures(leagueId, season));
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
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd web && npm test -- football.store`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(web): add FootballStore for competitions and fixtures"
```

---

### Task 13: Web — `FixturePickerComponent` partagé

**Files:**
- Create: `web/src/app/shared/fixture-picker.component.ts`

Composant de présentation pur (pas d'accès store) : reçoit les fixtures, gère la sélection, émet les ids choisis. Réutilisé par le wizard (Task 14) et l'admin (Task 15).

- [ ] **Step 1: Implémenter**

```typescript
import { DatePipe } from '@angular/common';
import { Component, computed, input, model } from '@angular/core';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { FixtureView } from '../core/models';

interface RoundGroup {
  round: string;
  fixtures: FixtureView[];
}

@Component({
  selector: 'sc-fixture-picker',
  imports: [DatePipe, FormsModule, ButtonModule, CheckboxModule],
  template: `
    <div class="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
      @for (group of rounds(); track group.round) {
        <section class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold sc-muted">{{ group.round }}</h4>
            <p-button
              label="Tout sélectionner"
              [text]="true"
              size="small"
              (onClick)="selectRound(group)"
            />
          </div>
          @for (fixture of group.fixtures; track fixture.id) {
            <label
              class="flex items-center gap-3 rounded-lg border p-2 cursor-pointer"
              data-testid="fixture-row"
            >
              <p-checkbox
                [binary]="true"
                [ngModel]="selected().has(fixture.id)"
                (ngModelChange)="toggle(fixture.id, $event)"
                [name]="'fixture-' + fixture.id"
              />
              <span class="flex-1 flex items-center gap-2">
                @if (fixture.teamALogo) {
                  <img [src]="fixture.teamALogo" alt="" class="h-5 w-5" />
                }
                {{ fixture.teamA }}
                <span class="sc-muted text-xs">vs</span>
                @if (fixture.teamBLogo) {
                  <img [src]="fixture.teamBLogo" alt="" class="h-5 w-5" />
                }
                {{ fixture.teamB }}
              </span>
              <span class="text-xs sc-muted">
                {{ fixture.kickoffAt | date: 'EEE d MMM HH:mm' }}
              </span>
            </label>
          }
        </section>
      }
    </div>
  `,
})
export class FixturePickerComponent {
  readonly fixtures = input.required<FixtureView[]>();
  // Ids des fixtures à masquer (déjà importées)
  readonly excludedIds = input<readonly string[]>([]);
  readonly selected = model(new Set<string>());

  readonly rounds = computed<RoundGroup[]>(() => {
    const excluded = new Set(this.excludedIds());
    const visible = this.fixtures().filter((f) => !excluded.has(f.id));
    const byRound = new Map<string, FixtureView[]>();
    for (const fixture of visible) {
      const round = fixture.round ?? 'Autres matchs';
      byRound.set(round, [...(byRound.get(round) ?? []), fixture]);
    }
    return [...byRound.entries()].map(([round, fixtures]) => ({ round, fixtures }));
  });

  toggle(fixtureId: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) {
      next.add(fixtureId);
    } else {
      next.delete(fixtureId);
    }
    this.selected.set(next);
  }

  selectRound(group: RoundGroup): void {
    const next = new Set(this.selected());
    for (const fixture of group.fixtures) {
      next.add(fixture.id);
    }
    this.selected.set(next);
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd web && npm run build 2>&1 | tail -5` (ou `npx ng build`)
Expected: build OK. (Composant pur sans logique métier complexe : la couverture viendra des tests du wizard ; pas de spec dédiée — YAGNI.)

- [ ] **Step 3: Commit**

```bash
git add web/src
git commit -m "feat(web): add shared fixture picker component"
```

---

### Task 14: Web — wizard de création de groupe

**Files:**
- Modify: `web/src/app/features/dashboard/dashboard.component.ts`
- Modify: `web/src/app/store/groups.store.ts` (si `create` ne transmet pas déjà le payload tel quel — vérifier)

- [ ] **Step 1: Étendre le dialog en wizard 2 étapes**

Remplacer le `<p-dialog>` et la logique du composant `DashboardComponent` :

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../../core/api.service';
import { Competition } from '../../core/models';
import { FixturePickerComponent } from '../../shared/fixture-picker.component';
import { AuthStore } from '../../store/auth.store';
import { FootballStore } from '../../store/football.store';
import { GroupsStore } from '../../store/groups.store';
```

Template du dialog (remplace l'actuel) :

```html
<p-dialog
  header="Nouveau groupe"
  [(visible)]="showCreateValue"
  [modal]="true"
  [style]="{ width: '32rem' }"
>
  @if (step() === 1) {
    <form class="flex flex-col gap-3" (ngSubmit)="next()">
      <input pInputText name="name" placeholder="Nom du groupe" required [(ngModel)]="name" />
      <textarea
        pTextarea
        name="description"
        placeholder="Description (optionnelle)"
        rows="3"
        [(ngModel)]="description"
      ></textarea>

      <fieldset class="flex flex-col gap-2">
        <legend class="text-sm sc-muted mb-1">
          Type de challenge (définitif)
        </legend>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="mode" value="custom" [(ngModel)]="mode" />
          Matchs personnalisés (saisie manuelle)
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="mode" value="competition" [(ngModel)]="mode" />
          Compétition officielle (scores automatiques)
        </label>
      </fieldset>

      <p-button
        type="submit"
        [label]="mode === 'competition' ? 'Suivant' : 'Créer'"
        [loading]="creating()"
        data-testid="group-create-next"
      />
    </form>
  } @else {
    <div class="flex flex-col gap-3">
      @if (footballStore.error()) {
        <p-message severity="warn" [text]="footballStore.error()!" />
      }
      <p-select
        [options]="footballStore.competitions()"
        optionLabel="name"
        placeholder="Choisir une compétition"
        [filter]="true"
        [ngModel]="selectedCompetition()"
        (ngModelChange)="onCompetitionChange($event)"
        name="competition"
        data-testid="competition-select"
      >
        <ng-template #item let-competition>
          <span class="flex items-center gap-2">
            <img [src]="competition.logo" alt="" class="h-4 w-4" />
            {{ competition.name }}
            <span class="text-xs sc-muted">{{ competition.country }}</span>
          </span>
        </ng-template>
      </p-select>

      @if (footballStore.loading()) {
        <div class="sc-skeleton h-24"></div>
      } @else if (selectedCompetition()) {
        <sc-fixture-picker
          [fixtures]="footballStore.fixtures()"
          [(selected)]="selectedFixtureIds"
        />
      }

      <div class="flex gap-2">
        <p-button label="Retour" severity="secondary" [text]="true" (onClick)="step.set(1)" />
        <p-button
          label="Créer le groupe"
          class="flex-1"
          [disabled]="!selectedCompetition() || selectedFixtureIds().size === 0"
          [loading]="creating()"
          (onClick)="create()"
          data-testid="group-create-submit"
        />
      </div>
    </div>
  }
</p-dialog>
```

Logique du composant :

```typescript
export class DashboardComponent implements OnInit {
  readonly store = inject(GroupsStore);
  readonly authStore = inject(AuthStore);
  readonly footballStore = inject(FootballStore);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly step = signal<1 | 2>(1);
  readonly selectedCompetition = signal<Competition | null>(null);
  readonly selectedFixtureIds = signal(new Set<string>());
  name = '';
  description = '';
  mode: 'custom' | 'competition' = 'custom';

  get showCreateValue(): boolean {
    return this.showCreate();
  }
  set showCreateValue(value: boolean) {
    this.showCreate.set(value);
    if (!value) {
      this.resetWizard();
    }
  }

  ngOnInit(): void {
    void this.store.load();
  }

  next(): void {
    if (!this.name.trim()) {
      return;
    }
    if (this.mode === 'custom') {
      void this.create();
      return;
    }
    this.step.set(2);
    void this.footballStore.loadCompetitions();
  }

  onCompetitionChange(competition: Competition | null): void {
    this.selectedCompetition.set(competition);
    this.selectedFixtureIds.set(new Set());
    if (competition) {
      void this.footballStore.loadFixtures(competition.leagueId, competition.season);
    }
  }

  async create(): Promise<void> {
    this.creating.set(true);
    try {
      const competition = this.selectedCompetition();
      const group = await this.store.create({
        name: this.name.trim(),
        description: this.description.trim() || undefined,
        competition:
          this.mode === 'competition' && competition
            ? {
                leagueId: competition.leagueId,
                season: competition.season,
                name: competition.name,
              }
            : undefined,
      });
      if (this.mode === 'competition') {
        await firstValueFrom(
          this.api.importMatches(group.id, [...this.selectedFixtureIds()]),
        );
      }
      void this.router.navigate(['/groups', group.id]);
    } finally {
      this.creating.set(false);
    }
  }

  private resetWizard(): void {
    this.step.set(1);
    this.mode = 'custom';
    this.selectedCompetition.set(null);
    this.selectedFixtureIds.set(new Set());
    this.footballStore.resetFixtures();
  }

  logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/login']);
  }
}
```

Vérifier que `GroupsStore.create` transmet le payload complet à `api.createGroup` (c'est le cas si la signature est `create(payload: CreateGroupPayload)` — lire `web/src/app/store/groups.store.ts` et l'adapter sinon). Vérifier l'import PrimeNG : si le projet utilise une version où le composant s'appelle `p-dropdown` (`DropdownModule`) au lieu de `p-select` (`SelectModule`), suivre ce qui existe déjà dans le code ou la doc PrimeNG de la version installée.

- [ ] **Step 2: Vérifier compilation + tests**

Run: `cd web && npm test && npm run build 2>&1 | tail -3`
Expected: PASS + build OK.

- [ ] **Step 3: Commit**

```bash
git add web/src
git commit -m "feat(web): two-step group creation wizard with competition picker"
```

---

### Task 15: Web — admin du groupe en mode compétition

**Files:**
- Modify: `web/src/app/features/group-admin/matches-panel.component.ts`
- Modify: `web/src/app/store/admin.store.ts`

- [ ] **Step 1: Ajouter `importMatches` à l'`AdminStore`**

Dans `web/src/app/store/admin.store.ts`, ajouter la méthode :

```typescript
      async importMatches(groupId: string, fixtureIds: string[]): Promise<void> {
        patchState(store, { saving: true, error: null });
        try {
          await firstValueFrom(api.importMatches(groupId, fixtureIds));
          await groupStore.loadMatches(groupId);
          patchState(store, { saving: false });
        } catch (error) {
          patchState(store, { saving: false, error: 'Import des matchs impossible' });
          throw error;
        }
      },
```

- [ ] **Step 2: Adapter `MatchesPanelComponent`**

Dans `web/src/app/features/group-admin/matches-panel.component.ts` :

1. Injecter `FootballStore` ; calculer le mode depuis le summary :

```typescript
  readonly footballStore = inject(FootballStore);
  readonly showPicker = signal(false);
  readonly selectedFixtureIds = signal(new Set<string>());

  readonly isCompetitionGroup = computed(
    () => this.groupStore.summary()?.competitionLeagueId != null,
  );
  readonly importedFixtureIds = computed(() =>
    this.groupStore
      .matches()
      .map((m) => m.fixtureId)
      .filter((id): id is string => id !== null),
  );
```

2. Dans le template : envelopper le `<form>` « Nouveau match » dans `@if (!isCompetitionGroup()) { … }`, et ajouter la branche compétition :

```html
@if (isCompetitionGroup()) {
  <p-button
    label="Ajouter des matchs"
    icon="pi pi-plus"
    (onClick)="openPicker()"
    data-testid="open-fixture-picker"
  />
  <p-dialog
    header="Matchs de la compétition"
    [(visible)]="showPickerValue"
    [modal]="true"
    [style]="{ width: '32rem' }"
  >
    @if (footballStore.loading()) {
      <div class="sc-skeleton h-24"></div>
    } @else {
      <sc-fixture-picker
        [fixtures]="footballStore.fixtures()"
        [excludedIds]="importedFixtureIds()"
        [(selected)]="selectedFixtureIds"
      />
    }
    <p-button
      label="Importer"
      styleClass="w-full mt-3"
      [disabled]="selectedFixtureIds().size === 0"
      [loading]="store.saving()"
      (onClick)="importSelection()"
      data-testid="import-fixtures"
    />
  </p-dialog>
}
```

3. Masquer la saisie de score pour les matchs liés : remplacer la condition `@if (match.status !== 'UPCOMING')` par `@if (match.status !== 'UPCOMING' && !match.fixtureId)` et ajouter en alternative :

```html
@if (match.fixtureId) {
  <p class="text-xs sc-muted">⚙️ Score automatique (compétition officielle)</p>
}
```

4. Méthodes :

```typescript
  get showPickerValue(): boolean {
    return this.showPicker();
  }
  set showPickerValue(value: boolean) {
    this.showPicker.set(value);
  }

  openPicker(): void {
    const summary = this.groupStore.summary();
    if (!summary?.competitionLeagueId || !summary.competitionSeason) {
      return;
    }
    this.selectedFixtureIds.set(new Set());
    this.showPicker.set(true);
    void this.footballStore.loadFixtures(
      summary.competitionLeagueId,
      summary.competitionSeason,
    );
  }

  async importSelection(): Promise<void> {
    try {
      await this.store.importMatches(this.groupId(), [...this.selectedFixtureIds()]);
      this.showPicker.set(false);
      this.messages.add({ severity: 'success', summary: 'Matchs importés ✔', life: 2000 });
    } catch {
      // erreur exposée par store.error()
    }
  }
```

Imports à ajouter : `computed` (Angular), `DialogModule` (PrimeNG), `FixturePickerComponent`, `FootballStore`. S'assurer que `groupStore.loadSummary(groupId)` est appelé (il l'est déjà par le shell du groupe — vérifier `group-shell.component.ts`, sinon l'appeler dans `ngOnInit`).

- [ ] **Step 3: Vérifier compilation + tests**

Run: `cd web && npm test && npm run build 2>&1 | tail -3`
Expected: PASS + build OK.

- [ ] **Step 4: Commit**

```bash
git add web/src
git commit -m "feat(web): fixture import and automatic-score mode in group admin"
```

---

### Task 16: Web — carte de match live (logos, score en cours, minute)

**Files:**
- Modify: `web/src/app/shared/match-card.component.ts`

- [ ] **Step 1: Enrichir le template**

Dans le bloc central des équipes, remplacer :

```html
<div class="flex items-center justify-center gap-3 text-lg">
  <span class="flex-1 text-right sc-display flex items-center justify-end gap-2">
    {{ match().teamA }}
    @if (match().fixture?.teamALogo) {
      <img [src]="match().fixture!.teamALogo" alt="" class="h-6 w-6" />
    }
  </span>
  @if (match().status === 'FINISHED') {
    <span class="sc-score text-3xl" data-testid="final-score">
      {{ match().finalScoreA }} – {{ match().finalScoreB }}
    </span>
  } @else if (liveScore(); as live) {
    <span class="sc-score text-3xl" data-testid="live-score">
      {{ live.scoreA }} – {{ live.scoreB }}
    </span>
  } @else {
    <span class="sc-muted text-sm uppercase tracking-widest">vs</span>
  }
  <span class="flex-1 sc-display flex items-center gap-2">
    @if (match().fixture?.teamBLogo) {
      <img [src]="match().fixture!.teamBLogo" alt="" class="h-6 w-6" />
    }
    {{ match().teamB }}
  </span>
</div>

@if (liveMinute(); as minute) {
  <p class="text-center text-xs" style="color: var(--sc-volt-400)" data-testid="live-minute">
    ⏱ {{ minute }}′
  </p>
}
```

Et le statut : matchs reportés/annulés affichés via la fixture. Étendre `STATUS_LABEL` localement :

```typescript
readonly statusInfo = computed(() => {
  const fixtureStatus = this.match().fixture?.status;
  if (fixtureStatus === 'POSTPONED') {
    return { label: 'Reporté', severity: 'warn' as const };
  }
  if (fixtureStatus === 'CANCELLED') {
    return { label: 'Annulé', severity: 'warn' as const };
  }
  return STATUS_LABEL[this.match().status];
});

readonly liveScore = computed(() => {
  const fixture = this.match().fixture;
  if (
    this.match().status === 'LIVE' &&
    fixture?.status === 'LIVE' &&
    fixture.scoreA !== null &&
    fixture.scoreB !== null
  ) {
    return { scoreA: fixture.scoreA, scoreB: fixture.scoreB };
  }
  return null;
});

readonly liveMinute = computed(() => {
  const fixture = this.match().fixture;
  return this.match().status === 'LIVE' && fixture?.status === 'LIVE'
    ? fixture.minute
    : null;
});
```

- [ ] **Step 2: Vérifier compilation + tests**

Run: `cd web && npm test && npm run build 2>&1 | tail -3`
Expected: PASS + build OK.

- [ ] **Step 3: Commit**

```bash
git add web/src
git commit -m "feat(web): show live score, minute and team logos on match cards"
```

---

### Task 17: Web — polling de l'onglet matchs

**Files:**
- Modify: `web/src/app/features/group/matches-page.component.ts`

- [ ] **Step 1: Implémenter le rafraîchissement conditionnel**

Dans `MatchesPageComponent` :

```typescript
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';

const LIVE_REFRESH_INTERVAL_MS = 60_000;

export class MatchesPageComponent implements OnInit, OnDestroy {
  // … existant …
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  readonly hasLiveMatch = computed(() =>
    this.store.matches().some((m) => m.status === 'LIVE'),
  );

  ngOnInit(): void {
    void this.store.loadMatches(this.groupId);
    this.refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && this.hasLiveMatch()) {
        void this.store.loadMatches(this.groupId);
      }
    }, LIVE_REFRESH_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
    }
  }
}
```

Attention : `loadMatches` passe `loading: true` → l'UI clignoterait (skeleton) toutes les 60 s. Ajouter une variante silencieuse dans `GroupStore` (`web/src/app/store/group.store.ts`) :

```typescript
    async refreshMatches(groupId: string): Promise<void> {
      try {
        const matches = await firstValueFrom(api.listMatches(groupId));
        patchState(store, { matches });
      } catch {
        // rafraîchissement silencieux : on garde les données affichées
      }
    },
```

Et utiliser `refreshMatches` dans le timer (pas `loadMatches`).

- [ ] **Step 2: Vérifier compilation + tests**

Run: `cd web && npm test && npm run build 2>&1 | tail -3`
Expected: PASS + build OK.

- [ ] **Step 3: Commit**

```bash
git add web/src
git commit -m "feat(web): silently refresh match list every 60s while a match is live"
```

---

### Task 18: Documentation, version, vérification finale

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT.md` (section fonctionnalités, si elle décrit la saisie de matchs)
- Modify: `api/package.json` + `web/package.json` (version 0.1.0 → 0.2.0)

- [ ] **Step 1: Documenter dans le README**

Ajouter après la section « Démarrage rapide » :

```markdown
## Compétitions officielles (API-Football)

Les groupes peuvent être liés à une compétition en cours (Coupe du Monde, Ligue 1…) :
matchs importés depuis [API-Football](https://www.api-football.com/), scores live et
points calculés automatiquement.

1. Créer une clé sur https://dashboard.api-sports.io (plan gratuit : 100 req/jour,
   limité aux saisons 2021-2023 ; plan payant requis pour les compétitions courantes).
2. La renseigner dans `api/.env` : `FOOTBALL_API_KEY=...`
3. Sans clé, les groupes « matchs personnalisés » fonctionnent normalement.
```

- [ ] **Step 2: Monter les versions (minor)**

`api/package.json` et `web/package.json` : `"version": "0.2.0"`.

- [ ] **Step 3: Vérification complète**

Run: `cd api && npm test && npm run test:e2e && cd ../web && npm test && npm run build 2>&1 | tail -3`
Expected: tout PASS.

- [ ] **Step 4: Vérification manuelle (smoke test)**

Run: `make dev-api` + `make dev-web`, puis dans le navigateur :
1. Créer un groupe « matchs personnalisés » → comportement existant intact.
2. Créer un groupe « compétition » (nécessite une clé API valide dans `api/.env` ; sans clé, vérifier que le wizard affiche « Compétitions indisponibles pour le moment »).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/PROJECT.md api/package.json web/package.json
git commit -m "docs: document API-Football setup and bump version to 0.2.0"
```
