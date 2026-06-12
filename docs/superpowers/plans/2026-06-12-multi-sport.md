# Multi-Sport Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre l'intégration api-sports à 9 sports — choix du sport à la création d'un groupe compétition, scores live et règlement automatique inchangés.

**Architecture:** Le module `api/src/football/` devient `api/src/sports/` avec une interface `SportApiAdapter` et deux implémentations : `FootballAdapter` (v3, code existant déplacé) et `GenericV1Adapter` (8 sports v1, parsing tolérant). Une façade `SportsApiClient` route par sport et porte les caches. `season` devient `String` partout (saisons v1 type « 2025-2026 »).

**Tech Stack:** NestJS 11 + Prisma 6, fetch natif, Angular 21 + Signal Store + PrimeNG. Tests Jest (unit + e2e mockés) et Vitest.

**Spec:** `docs/superpowers/specs/2026-06-12-multi-sport-design.md`
**Base:** branche `feat/football-api-integration` (l'intégration football y vit, non mergée).

**Particularités d'environnement (mémoire projet) :**
- `prisma migrate dev` refuse le mode non-interactif → générer le SQL via `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script`, l'écrire dans `prisma/migrations/<timestamp>_<name>/migration.sql`, puis `prisma migrate deploy` + `prisma generate`. URL DB locale : `postgresql://scorechallenge:scorechallenge@localhost:5435/scorechallenge`.
- e2e : `npx dotenv -e .env.test -- npx jest --config ./test/jest-e2e.json --runInBand <pattern>` (le hook pretest est bloqué). Après changement de schéma : `npx dotenv -e .env.test -- npx prisma db push --accept-data-loss --skip-generate`.
- Commandes `web/` : préfixer `export PATH="/opt/homebrew/opt/node/bin:$PATH"`.

---

## Vue d'ensemble des fichiers

**Backend — renommages (`git mv`) :**

| Avant | Après |
|---|---|
| `api/src/football/football-api.types.ts` | `api/src/sports/sports-api.types.ts` (réécrit) |
| `api/src/football/fixture-status.util.ts` | `api/src/sports/fixture-status.util.ts` (+ `mapV1Status`) |
| `api/src/football/football-api.client.ts` | supprimé (remplacé par adaptateurs + façade) |
| `api/src/football/football.service.ts` | `api/src/sports/sports.service.ts` |
| `api/src/football/football.controller.ts` | `api/src/sports/sports.controller.ts` |
| `api/src/football/fixture-sync.service.ts` | `api/src/sports/fixture-sync.service.ts` |
| `api/src/football/football.module.ts` | `api/src/sports/sports.module.ts` |
| `api/test/football.e2e-spec.ts` | `api/test/sports.e2e-spec.ts` |

**Backend — créations :**

| Fichier | Rôle |
|---|---|
| `api/src/sports/sport.config.ts` | Par sport : baseUrl, type d'API, fenêtre de surveillance, label |
| `api/src/sports/sports-http.ts` | `SportsHttpClient` : fetch + clé `SPORTS_API_KEY`, partagé par les adaptateurs |
| `api/src/sports/adapters/sport-adapter.interface.ts` | `SportApiAdapter`, `WatchedFixtureRef` |
| `api/src/sports/adapters/football.adapter.ts` | v3 (logique de l'actuel `FootballApiClient`) |
| `api/src/sports/adapters/generic-v1.adapter.ts` | 8 sports v1, parsing tolérant |
| `api/src/sports/sports-api.client.ts` | Façade : route par sport + caches |

**Frontend :**

| Fichier | Changement |
|---|---|
| `web/src/app/core/models.ts` | `Sport`, `season: string`, `sport` sur Group/GroupSummary/Competition/FixtureView |
| `web/src/app/core/api.service.ts` | Routes `/sports/:sport/...`, payload avec sport |
| `web/src/app/store/football.store.ts` → `web/src/app/store/sports.store.ts` | Paramètre sport |
| `web/src/app/shared/sport.ts` | Icônes + labels des sports (nouveau) |
| `web/src/app/features/dashboard/dashboard.component.ts` | Étape sport dans le wizard, icône sur les cartes |
| `web/src/app/features/group-admin/matches-panel.component.ts` | Picker piloté par le sport du summary |

---

### Task 1: Schéma Prisma — enum `Sport`, `season` en String

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Step 1: Ajouter l'enum `Sport` (avant l'enum `FixtureStatus`)**

```prisma
enum Sport {
  FOOTBALL
  AFL
  BASEBALL
  BASKETBALL
  HANDBALL
  HOCKEY
  NFL
  RUGBY
  VOLLEYBALL
}
```

- [ ] **Step 2: Étendre `Group`**

Remplacer les trois champs compétition :

```prisma
  competitionLeagueId   Int?
  competitionSeason     String?
  competitionName       String?
  sport                 Sport         @default(FOOTBALL)
```

- [ ] **Step 3: Étendre `Fixture`**

Remplacer `externalId Int @unique` et `season Int` :

```prisma
  externalId Int
  sport      Sport         @default(FOOTBALL)
  leagueId   Int
  season     String
```

Et remplacer l'index unique (supprimer `@unique` sur externalId, garder `@@index([leagueId, season])`) en ajoutant :

```prisma
  @@unique([sport, externalId])
```

- [ ] **Step 4: Générer et appliquer la migration (contournement non-interactif)**

```bash
cd api
mkdir -p prisma/migrations/20260612200000_add_sport_and_string_season
npx prisma migrate diff \
  --from-url "postgresql://scorechallenge:scorechallenge@localhost:5435/scorechallenge" \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/20260612200000_add_sport_and_string_season/migration.sql
```

**Vérifier le SQL généré** : la conversion `season` Int → String doit utiliser un cast. Si le SQL contient `ALTER COLUMN "season" SET DATA TYPE TEXT` sans `USING`, l'éditer :

```sql
ALTER TABLE "Fixture" ALTER COLUMN "season" SET DATA TYPE TEXT USING "season"::text;
ALTER TABLE "Group" ALTER COLUMN "competitionSeason" SET DATA TYPE TEXT USING "competitionSeason"::text;
```

Puis :

```bash
npx prisma migrate deploy
npx prisma generate
npx dotenv -e .env.test -- npx prisma db push --accept-data-loss --skip-generate
```

Expected: migration appliquée sur les deux DB sans erreur.

- [ ] **Step 5: Vérifier la casse attendue**

Run: `cd api && npm test 2>&1 | tail -3` et `npx tsc --noEmit 2>&1 | head -20`
Expected: erreurs TypeScript dans `football.service.ts` / specs (season number vs string) — c'est attendu, corrigé dans les tasks suivantes. Les tests unit purs (scoring, codes, statuts) passent encore.

- [ ] **Step 6: Commit**

```bash
git add api/prisma
git commit -m "feat(api): add Sport enum and switch season to string"
```

---

### Task 2: Config des sports + types pivot

**Files:**
- Create: `api/src/sports/sport.config.ts`
- Create: `api/src/sports/sports-api.types.ts` (contenu ci-dessous ; l'ancien `api/src/football/football-api.types.ts` sera supprimé en Task 5)
- Test: `api/src/sports/sport.config.spec.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`api/src/sports/sport.config.spec.ts` :

```typescript
import { Sport } from '@prisma/client';
import { SPORT_CONFIG } from './sport.config';

describe('SPORT_CONFIG', () => {
  it('covers every Sport enum value', () => {
    for (const sport of Object.values(Sport)) {
      expect(SPORT_CONFIG[sport]).toBeDefined();
      expect(SPORT_CONFIG[sport].baseUrl).toMatch(/^https:\/\//);
      expect(SPORT_CONFIG[sport].watchAfterKickoffMs).toBeGreaterThan(0);
    }
  });

  it('uses the v3 API only for football', () => {
    expect(SPORT_CONFIG.FOOTBALL.api).toBe('v3-football');
    expect(SPORT_CONFIG.BASKETBALL.api).toBe('v1');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd api && npx jest sport.config --verbose`
Expected: FAIL — `Cannot find module './sport.config'`.

- [ ] **Step 3: Implémenter `sport.config.ts`**

```typescript
import { Sport } from '@prisma/client';

export type SportApiKind = 'v3-football' | 'v1';

export interface SportConfig {
  baseUrl: string;
  api: SportApiKind;
  watchAfterKickoffMs: number;
  label: string;
}

const HOUR_MS = 60 * 60 * 1000;

export const SPORT_CONFIG: Record<Sport, SportConfig> = {
  FOOTBALL: {
    baseUrl: 'https://v3.football.api-sports.io',
    api: 'v3-football',
    watchAfterKickoffMs: 3 * HOUR_MS,
    label: 'Football',
  },
  AFL: {
    baseUrl: 'https://v1.afl.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 3.5 * HOUR_MS,
    label: 'Football australien',
  },
  BASEBALL: {
    baseUrl: 'https://v1.baseball.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 4 * HOUR_MS,
    label: 'Baseball',
  },
  BASKETBALL: {
    baseUrl: 'https://v1.basketball.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 2.5 * HOUR_MS,
    label: 'Basketball',
  },
  HANDBALL: {
    baseUrl: 'https://v1.handball.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 2 * HOUR_MS,
    label: 'Handball',
  },
  HOCKEY: {
    baseUrl: 'https://v1.hockey.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 3 * HOUR_MS,
    label: 'Hockey',
  },
  NFL: {
    baseUrl: 'https://v1.american-football.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 4 * HOUR_MS,
    label: 'Football américain',
  },
  RUGBY: {
    baseUrl: 'https://v1.rugby.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 2.5 * HOUR_MS,
    label: 'Rugby',
  },
  VOLLEYBALL: {
    baseUrl: 'https://v1.volleyball.api-sports.io',
    api: 'v1',
    watchAfterKickoffMs: 2.5 * HOUR_MS,
    label: 'Volleyball',
  },
};
```

- [ ] **Step 4: Créer `sports-api.types.ts`**

```typescript
import { FixtureStatus, Sport } from '@prisma/client';

// ---- Enveloppe commune api-sports ----
export interface ApiSportsEnvelope<T> {
  response: T[];
}

// ---- Réponses brutes v3 football (champs utilisés) ----
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

// ---- Réponses brutes v1 (champs utilisés ; structures tolérantes) ----
// Certains sports renvoient la ligue à plat, d'autres sous { league: {...} }.
export interface ApiV1LeagueEntry {
  id?: number;
  name?: string;
  type?: string;
  logo?: string | null;
  league?: { id: number; name: string; type?: string; logo?: string | null };
  country?: { name?: string };
  seasons?: { season: number | string; current?: boolean }[];
}

// Certains sports (NFL) enveloppent le match sous { game: {...} }.
export type ApiV1Score = number | { total?: number | null } | null;

export interface ApiV1GameCore {
  id: number;
  date: string | { date?: string };
  status: { short: string; long?: string };
}

export interface ApiV1GameEntry {
  id?: number;
  date?: string | { date?: string };
  status?: { short: string; long?: string };
  game?: ApiV1GameCore;
  league: { id: number; season: number | string; round?: string | null };
  teams: {
    home: { name: string; logo?: string | null };
    away: { name: string; logo?: string | null };
  };
  scores: { home: ApiV1Score; away: ApiV1Score };
}

// ---- Format pivot (seul format vu par le reste du code) ----
export interface NormalizedGame {
  externalId: number;
  leagueId: number;
  season: string;
  round: string | null;
  teamA: string;
  teamB: string;
  teamALogo: string | null;
  teamBLogo: string | null;
  kickoffAt: Date;
  status: FixtureStatus;
  minute: number | null;
  scoreA: number | null;
  scoreB: number | null;
}

// ---- DTO domaine ----
export interface CompetitionDto {
  sport: Sport;
  leagueId: number;
  name: string;
  type: string;
  logo: string | null;
  country: string;
  season: string;
}
```

- [ ] **Step 5: Vérifier le succès**

Run: `cd api && npx jest sport.config --verbose`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add api/src/sports
git commit -m "feat(api): add per-sport config and normalized game types"
```

---

### Task 3: Mapping statuts v1

**Files:**
- Create: `api/src/sports/fixture-status.util.ts` (copie de `api/src/football/fixture-status.util.ts` + ajout `mapV1Status` ; l'ancien sera supprimé en Task 5)
- Test: `api/src/sports/fixture-status.util.spec.ts`

- [ ] **Step 1: Copier l'existant puis écrire le test qui échoue**

```bash
cp api/src/football/fixture-status.util.ts api/src/sports/fixture-status.util.ts
cp api/src/football/fixture-status.util.spec.ts api/src/sports/fixture-status.util.spec.ts
```

Ajouter à `api/src/sports/fixture-status.util.spec.ts` (changer l'import en `from './fixture-status.util'` avec `mapFixtureStatus, mapV1Status`) :

```typescript
describe('mapV1Status', () => {
  it.each(['NS', 'TBD'])('maps %s to SCHEDULED', (short) => {
    expect(mapV1Status(short)).toBe('SCHEDULED');
  });

  it.each(['FT', 'AET', 'AOT', 'AWD'])('maps %s to FINISHED', (short) => {
    expect(mapV1Status(short)).toBe('FINISHED');
  });

  it.each(['PST', 'POST'])('maps %s to POSTPONED', (short) => {
    expect(mapV1Status(short)).toBe('POSTPONED');
  });

  it.each(['CANC', 'ABD', 'WO'])('maps %s to CANCELLED', (short) => {
    expect(mapV1Status(short)).toBe('CANCELLED');
  });

  it.each(['Q1', 'P2', 'S3', 'IN5', 'HT', 'OT', 'LIVE'])(
    'maps unknown period code %s to LIVE',
    (short) => {
      expect(mapV1Status(short)).toBe('LIVE');
    },
  );
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd api && npx jest src/sports/fixture-status --verbose`
Expected: FAIL — `mapV1Status` n'existe pas.

- [ ] **Step 3: Implémenter `mapV1Status` (ajout en fin de `api/src/sports/fixture-status.util.ts`)**

```typescript
const V1_SCHEDULED = new Set(['NS', 'TBD']);
const V1_FINISHED = new Set(['FT', 'AET', 'AOT', 'AWD']);
const V1_POSTPONED = new Set(['PST', 'POST']);
const V1_CANCELLED = new Set(['CANC', 'ABD', 'WO']);

// Les codes de période varient par sport (Q1, P2, S3, IN5…) :
// tout code ni programmé, ni terminé, ni annulé = match en cours.
export function mapV1Status(short: string): FixtureStatus {
  if (V1_SCHEDULED.has(short)) {
    return 'SCHEDULED';
  }
  if (V1_FINISHED.has(short)) {
    return 'FINISHED';
  }
  if (V1_POSTPONED.has(short)) {
    return 'POSTPONED';
  }
  if (V1_CANCELLED.has(short)) {
    return 'CANCELLED';
  }
  return 'LIVE';
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd api && npx jest src/sports/fixture-status --verbose`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/sports
git commit -m "feat(api): add v1 status mapping with LIVE fallback"
```

---

### Task 4: `SportsHttpClient` + adaptateurs

**Files:**
- Create: `api/src/sports/sports-http.ts`
- Create: `api/src/sports/adapters/sport-adapter.interface.ts`
- Create: `api/src/sports/adapters/football.adapter.ts`
- Create: `api/src/sports/adapters/generic-v1.adapter.ts`
- Test: `api/src/sports/adapters/generic-v1.adapter.spec.ts`
- Test: `api/src/sports/adapters/football.adapter.spec.ts`

- [ ] **Step 1: Créer l'interface**

`api/src/sports/adapters/sport-adapter.interface.ts` :

```typescript
import { CompetitionDto, NormalizedGame } from '../sports-api.types';

export interface WatchedFixtureRef {
  externalId: number;
  leagueId: number;
  season: string;
  kickoffAt: Date;
}

export interface SportApiAdapter {
  getCompetitions(): Promise<CompetitionDto[]>;
  getGames(leagueId: number, season: string): Promise<NormalizedGame[]>;
  getLiveGames(refs: WatchedFixtureRef[]): Promise<NormalizedGame[]>;
}
```

- [ ] **Step 2: Créer `SportsHttpClient`**

`api/src/sports/sports-http.ts` :

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiSportsEnvelope } from './sports-api.types';

@Injectable()
export class SportsHttpClient {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SPORTS_API_KEY'));
  }

  async request<T>(baseUrl: string, path: string): Promise<T[]> {
    const apiKey = this.config.get<string>('SPORTS_API_KEY');
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-apisports-key': apiKey ?? '' },
    });
    if (!response.ok) {
      throw new Error(`api-sports error ${response.status}`);
    }
    const body = (await response.json()) as ApiSportsEnvelope<T>;
    return body.response;
  }
}
```

- [ ] **Step 3: Écrire le test de l'adaptateur v1 qui échoue**

`api/src/sports/adapters/generic-v1.adapter.spec.ts` :

```typescript
import { SportsHttpClient } from '../sports-http';
import { ApiV1GameEntry, ApiV1LeagueEntry } from '../sports-api.types';
import { GenericV1Adapter } from './generic-v1.adapter';

describe('GenericV1Adapter', () => {
  let http: { request: jest.Mock; isConfigured: jest.Mock };
  let adapter: GenericV1Adapter;

  beforeEach(() => {
    http = { request: jest.fn(), isConfigured: jest.fn() };
    adapter = new GenericV1Adapter(
      http as unknown as SportsHttpClient,
      'BASKETBALL',
    );
  });

  it('normalizes flat league entries with current season', async () => {
    const entry: ApiV1LeagueEntry = {
      id: 12,
      name: 'NBA',
      type: 'League',
      logo: 'nba.png',
      country: { name: 'USA' },
      seasons: [
        { season: '2024-2025', current: false },
        { season: '2025-2026', current: true },
      ],
    };
    http.request.mockResolvedValue([entry]);
    const competitions = await adapter.getCompetitions();
    expect(http.request).toHaveBeenCalledWith(
      'https://v1.basketball.api-sports.io',
      '/leagues',
    );
    expect(competitions).toEqual([
      {
        sport: 'BASKETBALL',
        leagueId: 12,
        name: 'NBA',
        type: 'League',
        logo: 'nba.png',
        country: 'USA',
        season: '2025-2026',
      },
    ]);
  });

  it('normalizes wrapped league entries ({ league: {...} })', async () => {
    const entry: ApiV1LeagueEntry = {
      league: { id: 1, name: 'NFL', logo: null },
      country: { name: 'USA' },
      seasons: [{ season: 2026, current: true }],
    };
    http.request.mockResolvedValue([entry]);
    const competitions = await adapter.getCompetitions();
    expect(competitions[0].leagueId).toBe(1);
    expect(competitions[0].season).toBe('2026');
  });

  it('skips leagues without a current season', async () => {
    http.request.mockResolvedValue([
      { id: 9, name: 'Old', seasons: [{ season: 2020, current: false }] },
    ]);
    const competitions = await adapter.getCompetitions();
    expect(competitions).toEqual([]);
  });

  it('normalizes games with object scores (total)', async () => {
    const game: ApiV1GameEntry = {
      id: 401,
      date: '2026-06-15T18:00:00+00:00',
      status: { short: 'Q2' },
      league: { id: 12, season: '2025-2026', round: null },
      teams: {
        home: { name: 'Lakers', logo: 'lal.png' },
        away: { name: 'Celtics', logo: 'bos.png' },
      },
      scores: { home: { total: 54 }, away: { total: 49 } },
    };
    http.request.mockResolvedValue([game]);
    const games = await adapter.getGames(12, '2025-2026');
    expect(http.request).toHaveBeenCalledWith(
      'https://v1.basketball.api-sports.io',
      '/games?league=12&season=2025-2026',
    );
    expect(games[0]).toMatchObject({
      externalId: 401,
      season: '2025-2026',
      status: 'LIVE',
      scoreA: 54,
      scoreB: 49,
      minute: null,
    });
  });

  it('normalizes games with plain number scores and game wrapper', async () => {
    const game: ApiV1GameEntry = {
      game: {
        id: 88,
        date: { date: '2026-06-15T18:00:00+00:00' },
        status: { short: 'FT' },
      },
      league: { id: 3, season: 2026 },
      teams: { home: { name: 'A' }, away: { name: 'B' } },
      scores: { home: 27, away: 13 },
    };
    http.request.mockResolvedValue([game]);
    const games = await adapter.getGames(3, '2026');
    expect(games[0]).toMatchObject({
      externalId: 88,
      status: 'FINISHED',
      scoreA: 27,
      scoreB: 13,
    });
    expect(games[0].kickoffAt.toISOString()).toBe('2026-06-15T18:00:00.000Z');
  });

  it('fetches live games grouped by league/season/date and filters by ids', async () => {
    const mkGame = (id: number): ApiV1GameEntry => ({
      id,
      date: '2026-06-15T18:00:00+00:00',
      status: { short: 'Q1' },
      league: { id: 12, season: '2025-2026' },
      teams: { home: { name: 'A' }, away: { name: 'B' } },
      scores: { home: 2, away: 0 },
    });
    http.request.mockResolvedValue([mkGame(401), mkGame(999)]);
    const games = await adapter.getLiveGames([
      {
        externalId: 401,
        leagueId: 12,
        season: '2025-2026',
        kickoffAt: new Date('2026-06-15T18:00:00Z'),
      },
    ]);
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith(
      'https://v1.basketball.api-sports.io',
      '/games?league=12&season=2025-2026&date=2026-06-15',
    );
    expect(games).toHaveLength(1);
    expect(games[0].externalId).toBe(401);
  });
});
```

- [ ] **Step 4: Vérifier l'échec**

Run: `cd api && npx jest generic-v1 --verbose`
Expected: FAIL — module inexistant.

- [ ] **Step 5: Implémenter `GenericV1Adapter`**

`api/src/sports/adapters/generic-v1.adapter.ts` :

```typescript
import { Sport } from '@prisma/client';
import { mapV1Status } from '../fixture-status.util';
import { SPORT_CONFIG } from '../sport.config';
import {
  ApiV1GameEntry,
  ApiV1LeagueEntry,
  ApiV1Score,
  CompetitionDto,
  NormalizedGame,
} from '../sports-api.types';
import { SportsHttpClient } from '../sports-http';
import { SportApiAdapter, WatchedFixtureRef } from './sport-adapter.interface';

function scoreToNumber(score: ApiV1Score): number | null {
  if (typeof score === 'number') {
    return score;
  }
  if (score && typeof score.total === 'number') {
    return score.total;
  }
  return null;
}

function gameDate(entry: ApiV1GameEntry): Date {
  const raw = entry.game?.date ?? entry.date;
  const iso = typeof raw === 'string' ? raw : (raw?.date ?? '');
  return new Date(iso);
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class GenericV1Adapter implements SportApiAdapter {
  constructor(
    private readonly http: SportsHttpClient,
    private readonly sport: Sport,
  ) {}

  private get baseUrl(): string {
    return SPORT_CONFIG[this.sport].baseUrl;
  }

  async getCompetitions(): Promise<CompetitionDto[]> {
    const entries = await this.http.request<ApiV1LeagueEntry>(
      this.baseUrl,
      '/leagues',
    );
    return entries
      .map((entry) => this.toCompetition(entry))
      .filter((c): c is CompetitionDto => c !== null);
  }

  async getGames(leagueId: number, season: string): Promise<NormalizedGame[]> {
    const entries = await this.http.request<ApiV1GameEntry>(
      this.baseUrl,
      `/games?league=${leagueId}&season=${encodeURIComponent(season)}`,
    );
    return entries.map((entry) => this.toNormalizedGame(entry));
  }

  // Pas de batch par ids en v1 : une requête par (ligue, saison, jour UTC),
  // puis filtrage sur les externalIds demandés.
  async getLiveGames(refs: WatchedFixtureRef[]): Promise<NormalizedGame[]> {
    const wanted = new Set(refs.map((r) => r.externalId));
    const groups = new Map<string, WatchedFixtureRef>();
    for (const ref of refs) {
      groups.set(
        `${ref.leagueId}:${ref.season}:${utcDay(ref.kickoffAt)}`,
        ref,
      );
    }
    const results: NormalizedGame[] = [];
    for (const ref of groups.values()) {
      const entries = await this.http.request<ApiV1GameEntry>(
        this.baseUrl,
        `/games?league=${ref.leagueId}&season=${encodeURIComponent(ref.season)}&date=${utcDay(ref.kickoffAt)}`,
      );
      for (const entry of entries) {
        const game = this.toNormalizedGame(entry);
        if (wanted.has(game.externalId)) {
          results.push(game);
        }
      }
    }
    return results;
  }

  private toCompetition(entry: ApiV1LeagueEntry): CompetitionDto | null {
    const league = entry.league ?? entry;
    const current = entry.seasons?.find((s) => s.current);
    if (!league.id || !league.name || !current) {
      return null;
    }
    return {
      sport: this.sport,
      leagueId: league.id,
      name: league.name,
      type: league.type ?? 'League',
      logo: league.logo ?? null,
      country: entry.country?.name ?? '',
      season: String(current.season),
    };
  }

  private toNormalizedGame(entry: ApiV1GameEntry): NormalizedGame {
    const core = entry.game ?? entry;
    return {
      externalId: (core.id ?? 0) as number,
      leagueId: entry.league.id,
      season: String(entry.league.season),
      round: entry.league.round ?? null,
      teamA: entry.teams.home.name,
      teamB: entry.teams.away.name,
      teamALogo: entry.teams.home.logo ?? null,
      teamBLogo: entry.teams.away.logo ?? null,
      kickoffAt: gameDate(entry),
      status: mapV1Status(core.status?.short ?? 'NS'),
      minute: null,
      scoreA: scoreToNumber(entry.scores.home),
      scoreB: scoreToNumber(entry.scores.away),
    };
  }
}
```

- [ ] **Step 6: Écrire le test du `FootballAdapter` qui échoue**

`api/src/sports/adapters/football.adapter.spec.ts` :

```typescript
import { SportsHttpClient } from '../sports-http';
import { ApiFixtureEntry, ApiLeagueEntry } from '../sports-api.types';
import { FootballAdapter } from './football.adapter';

const leagueEntry: ApiLeagueEntry = {
  league: { id: 1, name: 'World Cup', type: 'Cup', logo: 'wc.png' },
  country: { name: 'World' },
  seasons: [
    { year: 2026, current: true, start: '2026-06-11', end: '2026-07-19' },
  ],
};

const fixtureEntry: ApiFixtureEntry = {
  fixture: {
    id: 101,
    date: '2026-06-15T16:00:00+00:00',
    status: { short: '1H', elapsed: 23 },
  },
  league: { id: 1, season: 2026, round: 'Group A - 1' },
  teams: {
    home: { name: 'France', logo: 'fr.png' },
    away: { name: 'Brésil', logo: 'br.png' },
  },
  goals: { home: 1, away: 0 },
};

describe('FootballAdapter', () => {
  let http: { request: jest.Mock };
  let adapter: FootballAdapter;

  beforeEach(() => {
    http = { request: jest.fn() };
    adapter = new FootballAdapter(http as unknown as SportsHttpClient);
  });

  it('normalizes current competitions', async () => {
    http.request.mockResolvedValue([leagueEntry]);
    const competitions = await adapter.getCompetitions();
    expect(http.request).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io',
      '/leagues?current=true',
    );
    expect(competitions[0]).toMatchObject({
      sport: 'FOOTBALL',
      leagueId: 1,
      season: '2026',
    });
  });

  it('normalizes fixtures with live minute', async () => {
    http.request.mockResolvedValue([fixtureEntry]);
    const games = await adapter.getGames(1, '2026');
    expect(http.request).toHaveBeenCalledWith(
      'https://v3.football.api-sports.io',
      '/fixtures?league=1&season=2026',
    );
    expect(games[0]).toMatchObject({
      externalId: 101,
      status: 'LIVE',
      minute: 23,
      scoreA: 1,
      season: '2026',
    });
  });

  it('chunks live requests by 20 ids', async () => {
    http.request.mockResolvedValue([]);
    const refs = Array.from({ length: 25 }, (_, i) => ({
      externalId: i + 1,
      leagueId: 1,
      season: '2026',
      kickoffAt: new Date(),
    }));
    await adapter.getLiveGames(refs);
    expect(http.request).toHaveBeenCalledTimes(2);
    expect(http.request).toHaveBeenNthCalledWith(
      1,
      'https://v3.football.api-sports.io',
      `/fixtures?ids=${refs
        .slice(0, 20)
        .map((r) => r.externalId)
        .join('-')}`,
    );
  });
});
```

- [ ] **Step 7: Vérifier l'échec puis implémenter `FootballAdapter`**

Run: `cd api && npx jest football.adapter --verbose` → FAIL (module inexistant).

`api/src/sports/adapters/football.adapter.ts` (reprend la logique de l'actuel `api/src/football/football-api.client.ts`, sans les caches — ils remontent dans la façade, Task 5) :

```typescript
import { mapFixtureStatus } from '../fixture-status.util';
import { SPORT_CONFIG } from '../sport.config';
import {
  ApiFixtureEntry,
  ApiLeagueEntry,
  CompetitionDto,
  NormalizedGame,
} from '../sports-api.types';
import { SportsHttpClient } from '../sports-http';
import { SportApiAdapter, WatchedFixtureRef } from './sport-adapter.interface';

const MAX_IDS_PER_REQUEST = 20;

export class FootballAdapter implements SportApiAdapter {
  constructor(private readonly http: SportsHttpClient) {}

  private get baseUrl(): string {
    return SPORT_CONFIG.FOOTBALL.baseUrl;
  }

  async getCompetitions(): Promise<CompetitionDto[]> {
    const entries = await this.http.request<ApiLeagueEntry>(
      this.baseUrl,
      '/leagues?current=true',
    );
    return entries
      .map((entry) => {
        const currentSeason = entry.seasons.find((s) => s.current);
        if (!currentSeason) {
          return null;
        }
        return {
          sport: 'FOOTBALL' as const,
          leagueId: entry.league.id,
          name: entry.league.name,
          type: entry.league.type,
          logo: entry.league.logo,
          country: entry.country.name,
          season: String(currentSeason.year),
        };
      })
      .filter((c): c is CompetitionDto => c !== null);
  }

  async getGames(leagueId: number, season: string): Promise<NormalizedGame[]> {
    const entries = await this.http.request<ApiFixtureEntry>(
      this.baseUrl,
      `/fixtures?league=${leagueId}&season=${encodeURIComponent(season)}`,
    );
    return entries.map((entry) => this.toNormalizedGame(entry));
  }

  async getLiveGames(refs: WatchedFixtureRef[]): Promise<NormalizedGame[]> {
    const ids = refs.map((r) => r.externalId);
    const results: NormalizedGame[] = [];
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
      const chunk = ids.slice(i, i + MAX_IDS_PER_REQUEST);
      const entries = await this.http.request<ApiFixtureEntry>(
        this.baseUrl,
        `/fixtures?ids=${chunk.join('-')}`,
      );
      results.push(...entries.map((entry) => this.toNormalizedGame(entry)));
    }
    return results;
  }

  private toNormalizedGame(entry: ApiFixtureEntry): NormalizedGame {
    return {
      externalId: entry.fixture.id,
      leagueId: entry.league.id,
      season: String(entry.league.season),
      round: entry.league.round ?? null,
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
  }
}
```

- [ ] **Step 8: Vérifier le succès**

Run: `cd api && npx jest src/sports --verbose`
Expected: PASS (config + statuts + 2 adaptateurs).

- [ ] **Step 9: Commit**

```bash
git add api/src/sports
git commit -m "feat(api): add football v3 and generic v1 sport adapters"
```

---

### Task 5: Façade `SportsApiClient` + bascule du module

Grosse étape de couture : la façade remplace `FootballApiClient`, le module `football/` disparaît, les services/contrôleur deviennent `sports/*` avec routes `/sports/:sport/...`.

**Files:**
- Create: `api/src/sports/sports-api.client.ts`
- Create: `api/src/sports/sports.service.ts`
- Create: `api/src/sports/sports.controller.ts`
- Create: `api/src/sports/sports.module.ts`
- Create: `api/src/sports/fixture-sync.service.ts`
- Delete: `api/src/football/` (tout le dossier)
- Modify: `api/src/app.module.ts`
- Rename/Modify: `api/test/football.e2e-spec.ts` → `api/test/sports.e2e-spec.ts`
- Modify: `api/test/fixture-sync.e2e-spec.ts`

- [ ] **Step 1: Créer la façade**

`api/src/sports/sports-api.client.ts` :

```typescript
import { Injectable } from '@nestjs/common';
import { Sport } from '@prisma/client';
import { FootballAdapter } from './adapters/football.adapter';
import { GenericV1Adapter } from './adapters/generic-v1.adapter';
import {
  SportApiAdapter,
  WatchedFixtureRef,
} from './adapters/sport-adapter.interface';
import { SPORT_CONFIG } from './sport.config';
import { CompetitionDto, NormalizedGame } from './sports-api.types';
import { SportsHttpClient } from './sports-http';

const COMPETITIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GAMES_CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class SportsApiClient {
  private readonly adapters: Record<Sport, SportApiAdapter>;
  private readonly competitionsCache = new Map<Sport, CacheEntry<CompetitionDto[]>>();
  private readonly gamesCache = new Map<string, CacheEntry<NormalizedGame[]>>();

  constructor(private readonly http: SportsHttpClient) {
    this.adapters = Object.fromEntries(
      Object.entries(SPORT_CONFIG).map(([sport, config]) => [
        sport,
        config.api === 'v3-football'
          ? new FootballAdapter(http)
          : new GenericV1Adapter(http, sport as Sport),
      ]),
    ) as Record<Sport, SportApiAdapter>;
  }

  isConfigured(): boolean {
    return this.http.isConfigured();
  }

  async getCompetitions(sport: Sport): Promise<CompetitionDto[]> {
    const cached = this.competitionsCache.get(sport);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const competitions = await this.adapters[sport].getCompetitions();
    this.competitionsCache.set(sport, {
      value: competitions,
      expiresAt: Date.now() + COMPETITIONS_CACHE_TTL_MS,
    });
    return competitions;
  }

  async getGames(
    sport: Sport,
    leagueId: number,
    season: string,
  ): Promise<NormalizedGame[]> {
    const cacheKey = `${sport}:${leagueId}:${season}`;
    const cached = this.gamesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const games = await this.adapters[sport].getGames(leagueId, season);
    this.gamesCache.set(cacheKey, {
      value: games,
      expiresAt: Date.now() + GAMES_CACHE_TTL_MS,
    });
    return games;
  }

  // Pas de cache : état live.
  getLiveGames(sport: Sport, refs: WatchedFixtureRef[]): Promise<NormalizedGame[]> {
    return this.adapters[sport].getLiveGames(refs);
  }
}
```

- [ ] **Step 2: Créer `SportsService`**

`api/src/sports/sports.service.ts` (remplace `football.service.ts`) :

```typescript
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Fixture, Sport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SportsApiClient } from './sports-api.client';
import { CompetitionDto, NormalizedGame } from './sports-api.types';

@Injectable()
export class SportsService {
  constructor(
    private readonly client: SportsApiClient,
    private readonly prisma: PrismaService,
  ) {}

  getCompetitions(sport: Sport): Promise<CompetitionDto[]> {
    this.assertConfigured();
    return this.client.getCompetitions(sport);
  }

  async listFixtures(
    sport: Sport,
    leagueId: number,
    season: string,
  ): Promise<Fixture[]> {
    this.assertConfigured();
    const games = await this.client.getGames(sport, leagueId, season);
    return Promise.all(games.map((game) => this.upsertGame(sport, game)));
  }

  upsertGame(sport: Sport, game: NormalizedGame): Promise<Fixture> {
    const data = {
      leagueId: game.leagueId,
      season: game.season,
      round: game.round,
      teamA: game.teamA,
      teamB: game.teamB,
      teamALogo: game.teamALogo,
      teamBLogo: game.teamBLogo,
      kickoffAt: game.kickoffAt,
      status: game.status,
      minute: game.minute,
      scoreA: game.scoreA,
      scoreB: game.scoreB,
    };
    return this.prisma.fixture.upsert({
      where: { sport_externalId: { sport, externalId: game.externalId } },
      create: { sport, externalId: game.externalId, ...data },
      update: data,
    });
  }

  private assertConfigured(): void {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException(
        'API sports non configurée (SPORTS_API_KEY manquante)',
      );
    }
  }
}
```

- [ ] **Step 3: Créer `SportsController`**

`api/src/sports/sports.controller.ts` :

```typescript
import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Sport } from '@prisma/client';
import { OwnerRoleGuard } from '../auth/owner-role.guard';
import { SportsService } from './sports.service';

@UseGuards(OwnerRoleGuard)
@Controller('sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get(':sport/competitions')
  competitions(@Param('sport', new ParseEnumPipe(Sport)) sport: Sport) {
    return this.sportsService.getCompetitions(sport);
  }

  @Get(':sport/competitions/:leagueId/fixtures')
  fixtures(
    @Param('sport', new ParseEnumPipe(Sport)) sport: Sport,
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query('season') season: string,
  ) {
    return this.sportsService.listFixtures(sport, leagueId, season ?? '');
  }
}
```

- [ ] **Step 4: Créer `FixtureSyncService` multi-sports**

`api/src/sports/fixture-sync.service.ts` (remplace l'ancien ; fenêtre par sport, batch par sport, plus de `mapFixtureStatus` — `NormalizedGame.status` est déjà mappé) :

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Fixture, Sport } from '@prisma/client';
import { MatchSettlementService } from '../matches/match-settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { SPORT_CONFIG } from './sport.config';
import { SportsApiClient } from './sports-api.client';
import { SportsService } from './sports.service';

const WATCH_BEFORE_KICKOFF_MS = 5 * 60 * 1000;
const MAX_WATCH_AFTER_KICKOFF_MS = Math.max(
  ...Object.values(SPORT_CONFIG).map((c) => c.watchAfterKickoffMs),
);

@Injectable()
export class FixtureSyncService {
  private readonly logger = new Logger(FixtureSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SportsApiClient,
    private readonly sportsService: SportsService,
    private readonly settlementService: MatchSettlementService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sync(): Promise<void> {
    if (!this.client.isConfigured()) {
      return;
    }
    const now = Date.now();
    const candidates = await this.prisma.fixture.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        kickoffAt: {
          gte: new Date(now - MAX_WATCH_AFTER_KICKOFF_MS),
          lte: new Date(now + WATCH_BEFORE_KICKOFF_MS),
        },
        matches: { some: {} },
      },
    });
    // Fenêtre précise par sport
    const watched = candidates.filter(
      (f) =>
        f.kickoffAt.getTime() >=
        now - SPORT_CONFIG[f.sport].watchAfterKickoffMs,
    );
    if (watched.length === 0) {
      return;
    }
    const bySport = new Map<Sport, Fixture[]>();
    for (const fixture of watched) {
      bySport.set(fixture.sport, [
        ...(bySport.get(fixture.sport) ?? []),
        fixture,
      ]);
    }
    for (const [sport, fixtures] of bySport) {
      await this.syncSport(sport, fixtures);
    }
  }

  private async syncSport(sport: Sport, fixtures: Fixture[]): Promise<void> {
    try {
      const games = await this.client.getLiveGames(
        sport,
        fixtures.map((f) => ({
          externalId: f.externalId,
          leagueId: f.leagueId,
          season: f.season,
          kickoffAt: f.kickoffAt,
        })),
      );
      for (const game of games) {
        const previous = fixtures.find(
          (f) => f.externalId === game.externalId,
        );
        if (!previous) {
          continue;
        }
        const updated = await this.sportsService.upsertGame(sport, game);
        const justFinished =
          previous.status !== 'FINISHED' && game.status === 'FINISHED';
        if (
          justFinished &&
          updated.scoreA !== null &&
          updated.scoreB !== null
        ) {
          await this.settleLinkedMatches(
            updated.id,
            updated.scoreA,
            updated.scoreB,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Synchronisation ${sport} échouée : ${(error as Error).message}`,
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

- [ ] **Step 5: Créer le module, brancher, supprimer l'ancien**

`api/src/sports/sports.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchesModule } from '../matches/matches.module';
import { FixtureSyncService } from './fixture-sync.service';
import { SportsApiClient } from './sports-api.client';
import { SportsController } from './sports.controller';
import { SportsHttpClient } from './sports-http';
import { SportsService } from './sports.service';

@Module({
  imports: [ScheduleModule.forRoot(), MatchesModule],
  controllers: [SportsController],
  providers: [SportsHttpClient, SportsApiClient, SportsService, FixtureSyncService],
  exports: [SportsApiClient, SportsService],
})
export class SportsModule {}
```

Dans `api/src/app.module.ts` : remplacer l'import `FootballModule` (`./football/football.module`) par `SportsModule` (`./sports/sports.module`) — dans la liste d'imports aussi.

```bash
git rm -r api/src/football
```

- [ ] **Step 6: Adapter les e2e**

```bash
git mv api/test/football.e2e-spec.ts api/test/sports.e2e-spec.ts
```

Réécrire `api/test/sports.e2e-spec.ts` — le mock porte sur la **façade** `SportsApiClient` :

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { SportsApiClient } from '../src/sports/sports-api.client';
import {
  CompetitionDto,
  NormalizedGame,
} from '../src/sports/sports-api.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { registerOwner } from './groups.e2e-spec';
import { resetDb } from './test-utils';

export const WORLD_CUP: CompetitionDto = {
  sport: 'FOOTBALL',
  leagueId: 1,
  name: 'World Cup',
  type: 'Cup',
  logo: 'wc.png',
  country: 'World',
  season: '2026',
};

export function fakeGame(overrides: {
  id: number;
  status?: NormalizedGame['status'];
  minute?: number | null;
  scoreA?: number | null;
  scoreB?: number | null;
  leagueId?: number;
  season?: string;
}): NormalizedGame {
  return {
    externalId: overrides.id,
    leagueId: overrides.leagueId ?? 1,
    season: overrides.season ?? '2026',
    round: 'Group A - 1',
    teamA: 'France',
    teamB: 'Brésil',
    teamALogo: 'fr.png',
    teamBLogo: 'br.png',
    kickoffAt: new Date('2026-06-15T16:00:00Z'),
    status: overrides.status ?? 'SCHEDULED',
    minute: overrides.minute ?? null,
    scoreA: overrides.scoreA ?? null,
    scoreB: overrides.scoreB ?? null,
  };
}

export const sportsClientMock = {
  isConfigured: jest.fn().mockReturnValue(true),
  getCompetitions: jest.fn(),
  getGames: jest.fn(),
  getLiveGames: jest.fn(),
};

export async function createTestAppWithSportsMock(): Promise<
  INestApplication<App>
> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SportsApiClient)
    .useValue(sportsClientMock)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app);
  await app.init();
  return app;
}

describe('Sports (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    app = await createTestAppWithSportsMock();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    sportsClientMock.isConfigured.mockReturnValue(true);
    await resetDb(app);
    token = await registerOwner(app);
  });

  afterAll(() => app.close());

  it('lists competitions for a sport', async () => {
    sportsClientMock.getCompetitions.mockResolvedValue([WORLD_CUP]);
    const res = await request(app.getHttpServer())
      .get('/sports/FOOTBALL/competitions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual([WORLD_CUP]);
    expect(sportsClientMock.getCompetitions).toHaveBeenCalledWith('FOOTBALL');
  });

  it('rejects an unknown sport with 400', async () => {
    await request(app.getHttpServer())
      .get('/sports/CRICKET/competitions')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer())
      .get('/sports/FOOTBALL/competitions')
      .expect(401);
  });

  it('lists fixtures and upserts them with the sport', async () => {
    sportsClientMock.getGames.mockResolvedValue([
      fakeGame({ id: 401, season: '2025-2026', leagueId: 12 }),
    ]);
    const res = await request(app.getHttpServer())
      .get('/sports/BASKETBALL/competitions/12/fixtures?season=2025-2026')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(sportsClientMock.getGames).toHaveBeenCalledWith(
      'BASKETBALL',
      12,
      '2025-2026',
    );
    const prisma = app.get(PrismaService);
    const stored = await prisma.fixture.findUnique({
      where: { sport_externalId: { sport: 'BASKETBALL', externalId: 401 } },
    });
    expect(stored?.season).toBe('2025-2026');
  });

  it('returns 503 when the sports API is not configured', async () => {
    sportsClientMock.isConfigured.mockReturnValue(false);
    await request(app.getHttpServer())
      .get('/sports/FOOTBALL/competitions')
      .set('Authorization', `Bearer ${token}`)
      .expect(503);
  });
});
```

Adapter `api/test/fixture-sync.e2e-spec.ts` : remplacer les imports `football.e2e-spec` par `sports.e2e-spec` (`createTestAppWithSportsMock`, `fakeGame`, `sportsClientMock`), `getFixturesByIds` → `getLiveGames`, et les appels mock :

```typescript
// avant : footballClientMock.getFixturesByIds.mockResolvedValue([fakeApiFixture({ id: 777, status: '1H', elapsed: 23, home: 1, away: 0 })]);
sportsClientMock.getLiveGames.mockResolvedValue([
  fakeGame({ id: 777, status: 'LIVE', minute: 23, scoreA: 1, scoreB: 0 }),
]);
// l'assertion d'appel devient :
expect(sportsClientMock.getLiveGames).toHaveBeenCalledWith('FOOTBALL', [
  expect.objectContaining({ externalId: 777 }),
]);
// et pour le règlement :
sportsClientMock.getLiveGames.mockResolvedValue([
  fakeGame({ id: 777, status: 'FINISHED', scoreA: 2, scoreB: 0 }),
]);
```

Les `seedFixture`/créations de fixtures en DB dans `match-import.e2e-spec.ts`, `match-list.e2e-spec.ts` et `fixture-sync.e2e-spec.ts` : `season: 2026` → `season: '2026'` (string). Le `sport` est omis (default FOOTBALL).

- [ ] **Step 7: Corriger la création de groupe (string season)**

Dans `api/src/groups/dto/create-group.dto.ts`, `CompetitionRefDto.season` devient :

```typescript
  @IsNotEmpty()
  @MaxLength(12)
  season: string;
```

(import `IsNotEmpty` déjà présent). Les tests e2e qui envoient `season: 2026` (nombre) passent à `season: '2026'` : `groups.e2e-spec.ts`, `match-import.e2e-spec.ts`, `match-list.e2e-spec.ts`, `fixture-sync.e2e-spec.ts`.

Dans `api/src/matches/matches.service.ts` (`importFixtures`), la comparaison `f.season !== group.competitionSeason` reste valide (string === string).

- [ ] **Step 8: Vérifier tout vert**

Run: `cd api && npx tsc --noEmit && npm test && npx dotenv -e .env.test -- npx jest --config ./test/jest-e2e.json --runInBand`
Expected: compilation propre, unit PASS, e2e PASS (~160+ tests).

- [ ] **Step 9: Commit**

```bash
git add -A api/src api/test
git commit -m "feat(api): replace football module with multi-sport sports module"
```

---

### Task 6: Sport sur le groupe (DTO, service, summary, import)

**Files:**
- Modify: `api/src/groups/dto/create-group.dto.ts`
- Modify: `api/src/groups/groups.service.ts`
- Modify: `api/src/matches/matches.service.ts`
- Test: `api/test/groups.e2e-spec.ts`, `api/test/match-import.e2e-spec.ts`

- [ ] **Step 1: Ajouter les cas e2e qui échouent**

Dans `api/test/groups.e2e-spec.ts`, modifier le test `creates a group linked to a competition` pour envoyer et vérifier le sport :

```typescript
      .send({
        name: 'CdM entre potes',
        competition: { sport: 'BASKETBALL', leagueId: 12, season: '2025-2026', name: 'NBA' },
      })
      .expect(201);
    const body = res.body as {
      sport: string;
      competitionLeagueId: number;
      competitionSeason: string;
      competitionName: string;
    };
    expect(body.sport).toBe('BASKETBALL');
    expect(body.competitionLeagueId).toBe(12);
    expect(body.competitionSeason).toBe('2025-2026');
```

Et dans le test summary, vérifier `summary.sport === 'BASKETBALL'`.

Dans `api/test/match-import.e2e-spec.ts`, ajouter un cas :

```typescript
  it('rejects fixtures from another sport', async () => {
    const groupId = await createCompetitionGroup(app, token); // FOOTBALL league 1
    const prisma = app.get(PrismaService);
    const basketFixture = await prisma.fixture.create({
      data: {
        externalId: 901,
        sport: 'BASKETBALL',
        leagueId: 1,
        season: '2026',
        teamA: 'Lakers',
        teamB: 'Celtics',
        kickoffAt: new Date(FUTURE_KICKOFF),
      },
    });
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [basketFixture.id] })
      .expect(400);
  });
```

(Adapter `createCompetitionGroup` du fichier pour envoyer `competition: { sport: 'FOOTBALL', leagueId: 1, season: '2026', name: 'World Cup' }`.)

- [ ] **Step 2: Vérifier l'échec**

Run: `cd api && npx dotenv -e .env.test -- npx jest --config ./test/jest-e2e.json --runInBand groups.e2e` puis `match-import`
Expected: FAIL — `sport` rejeté par la whitelist du DTO / pas de validation sport à l'import.

- [ ] **Step 3: Étendre le DTO**

`api/src/groups/dto/create-group.dto.ts` — `CompetitionRefDto` complet :

```typescript
import { Sport } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompetitionRefDto {
  @IsEnum(Sport)
  sport: Sport;

  @IsInt()
  leagueId: number;

  @IsNotEmpty()
  @MaxLength(12)
  season: string;

  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
```

- [ ] **Step 4: Persister le sport**

Dans `api/src/groups/groups.service.ts` (`create`), ajouter au `data` du `tx.group.create` :

```typescript
          sport: competition?.sport ?? 'FOOTBALL',
```

Dans `getSummary`, ajouter au retour :

```typescript
      sport: group.sport,
```

- [ ] **Step 5: Valider le sport à l'import**

Dans `api/src/matches/matches.service.ts` (`importFixtures`), étendre le contrôle `foreign` :

```typescript
    const foreign = fixtures.find(
      (f) =>
        f.sport !== group.sport ||
        f.leagueId !== group.competitionLeagueId ||
        f.season !== group.competitionSeason,
    );
```

- [ ] **Step 6: Vérifier le succès + non-régression**

Run: `cd api && npm test && npx dotenv -e .env.test -- npx jest --config ./test/jest-e2e.json --runInBand`
Expected: PASS complet.

- [ ] **Step 7: Commit**

```bash
git add api/src api/test
git commit -m "feat(api): carry sport on groups and validate it at fixture import"
```

---

### Task 7: e2e basketball de bout en bout (sync multi-sport)

**Files:**
- Test: `api/test/fixture-sync.e2e-spec.ts` (ajout d'un describe)

- [ ] **Step 1: Ajouter le scénario basketball qui échoue (ou passe — vérifier qu'il couvre le routage par sport)**

À la fin de `api/test/fixture-sync.e2e-spec.ts` :

```typescript
describe('FixtureSync multi-sport (e2e)', () => {
  // réutilise app/prisma/sync du describe principal via variables partagées,
  // ou recrée localement avec createTestAppWithSportsMock()

  it('routes basketball fixtures to the basketball adapter and settles', async () => {
    const token = await registerOwner(app, 'basket@test.io');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'NBA Challenge',
        competition: { sport: 'BASKETBALL', leagueId: 12, season: '2025-2026', name: 'NBA' },
      })
      .expect(201);
    const basketGroupId = (groupRes.body as { id: string }).id;

    const fixture = await prisma.fixture.create({
      data: {
        externalId: 901,
        sport: 'BASKETBALL',
        leagueId: 12,
        season: '2025-2026',
        teamA: 'Lakers',
        teamB: 'Celtics',
        kickoffAt: new Date(Date.now() - 60 * 1000),
        status: 'SCHEDULED',
      },
    });
    await request(app.getHttpServer())
      .post(`/groups/${basketGroupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixture.id] })
      .expect(201);

    sportsClientMock.getLiveGames.mockResolvedValue([
      fakeGame({
        id: 901,
        status: 'FINISHED',
        scoreA: 102,
        scoreB: 99,
        leagueId: 12,
        season: '2025-2026',
      }),
    ]);
    await sync.sync();

    expect(sportsClientMock.getLiveGames).toHaveBeenCalledWith('BASKETBALL', [
      expect.objectContaining({ externalId: 901, season: '2025-2026' }),
    ]);
    const updated = await prisma.fixture.findUniqueOrThrow({
      where: { id: fixture.id },
    });
    expect(updated.status).toBe('FINISHED');
    const match = await prisma.match.findFirstOrThrow({
      where: { groupId: basketGroupId },
    });
    expect(match.finalScoreA).toBe(102);
  });
});
```

(Intégrer ce test dans le `describe` principal pour réutiliser `app`, `prisma`, `sync` — le `beforeEach` global reset la DB, le test crée son propre groupe.)

- [ ] **Step 2: Lancer et vérifier**

Run: `cd api && npx dotenv -e .env.test -- npx jest --config ./test/jest-e2e.json --runInBand fixture-sync`
Expected: PASS (si FAIL, le routage par sport du sync est défectueux — corriger `fixture-sync.service.ts`).

- [ ] **Step 3: Commit**

```bash
git add api/test
git commit -m "test(api): cover basketball end-to-end sync and settlement"
```

---

### Task 8: Environnement — `SPORTS_API_KEY`

**Files:**
- Modify: `api/.env`, `api/.env.example`, `api/.env.test`

- [ ] **Step 1: Renommer la variable**

Dans `api/.env` : renommer `FOOTBALL_API_KEY` → `SPORTS_API_KEY` (garder la valeur de la clé déjà renseignée), supprimer `FOOTBALL_API_URL`.
Dans `api/.env.example` :

```bash
# api-sports.io — une clé pour tous les sports ; vide = synchronisation désactivée
SPORTS_API_KEY=
```

Dans `api/.env.test` : `SPORTS_API_KEY=` (vide), supprimer `FOOTBALL_API_URL`.

- [ ] **Step 2: Vérifier qu'aucune référence ne traîne**

Run: `grep -rn 'FOOTBALL_API' api/src api/test api/.env.example`
Expected: aucun résultat.

- [ ] **Step 3: Commit**

```bash
git add api/.env.example
git commit -m "chore(api): rename FOOTBALL_API_KEY to SPORTS_API_KEY"
```

---

### Task 9: Web — modèles, ApiService, SportsStore

**Files:**
- Modify: `web/src/app/core/models.ts`
- Modify: `web/src/app/core/api.service.ts`
- Create: `web/src/app/shared/sport.ts`
- Rename: `web/src/app/store/football.store.ts` → `web/src/app/store/sports.store.ts`
- Rename: `web/src/app/store/football.store.spec.ts` → `web/src/app/store/sports.store.spec.ts`

- [ ] **Step 1: Modèles**

Dans `web/src/app/core/models.ts` :

```typescript
export type Sport =
  | 'FOOTBALL'
  | 'AFL'
  | 'BASEBALL'
  | 'BASKETBALL'
  | 'HANDBALL'
  | 'HOCKEY'
  | 'NFL'
  | 'RUGBY'
  | 'VOLLEYBALL';
```

- `Group` et `GroupSummary` : + `sport: Sport;` et `competitionSeason: string | null` (était `number | null`).
- `Competition` : + `sport: Sport;`, `season: string` (était number), `logo: string | null`.
- `FixtureView` : `season: string`, + `sport: Sport`.
- Mettre à jour les fabriques des specs : `fakeGroup` (groups.store.spec) + `sport: 'FOOTBALL'`, fixtures du sports.store.spec.

- [ ] **Step 2: `shared/sport.ts`**

```typescript
import { Sport } from '../core/models';

export const SPORT_META: Record<Sport, { icon: string; label: string }> = {
  FOOTBALL: { icon: '⚽', label: 'Football' },
  AFL: { icon: '🦘', label: 'Football australien' },
  BASEBALL: { icon: '⚾', label: 'Baseball' },
  BASKETBALL: { icon: '🏀', label: 'Basketball' },
  HANDBALL: { icon: '🤾', label: 'Handball' },
  HOCKEY: { icon: '🏒', label: 'Hockey' },
  NFL: { icon: '🏈', label: 'Football américain' },
  RUGBY: { icon: '🏉', label: 'Rugby' },
  VOLLEYBALL: { icon: '🏐', label: 'Volleyball' },
};

export const SPORTS: Sport[] = Object.keys(SPORT_META) as Sport[];
```

- [ ] **Step 3: ApiService**

Dans `web/src/app/core/api.service.ts` :

```typescript
  // Sports
  sportCompetitions(sport: Sport): Observable<Competition[]> {
    return this.http.get<Competition[]>(`${BASE}/sports/${sport}/competitions`);
  }
  competitionFixtures(sport: Sport, leagueId: number, season: string): Observable<FixtureView[]> {
    return this.http.get<FixtureView[]>(
      `${BASE}/sports/${sport}/competitions/${leagueId}/fixtures?season=${encodeURIComponent(season)}`,
    );
  }
```

(supprimer `footballCompetitions` ; `importMatches` inchangé). `CreateGroupPayload.competition` devient `{ sport: Sport; leagueId: number; season: string; name: string }`. Ajouter `Sport` à l'import des models.

- [ ] **Step 4: SportsStore**

```bash
git mv web/src/app/store/football.store.ts web/src/app/store/sports.store.ts
git mv web/src/app/store/football.store.spec.ts web/src/app/store/sports.store.spec.ts
```

Réécrire `sports.store.ts` :

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Competition, FixtureView, Sport } from '../core/models';

interface SportsState {
  competitions: Competition[];
  fixtures: FixtureView[];
  loading: boolean;
  error: string | null;
}

const initialState: SportsState = {
  competitions: [],
  fixtures: [],
  loading: false,
  error: null,
};

export const SportsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(ApiService)) => ({
    async loadCompetitions(sport: Sport): Promise<void> {
      patchState(store, { loading: true, error: null, competitions: [] });
      try {
        const competitions = await firstValueFrom(api.sportCompetitions(sport));
        patchState(store, { competitions, loading: false });
      } catch {
        patchState(store, {
          loading: false,
          error: 'Compétitions indisponibles pour le moment',
        });
      }
    },
    async loadFixtures(sport: Sport, leagueId: number, season: string): Promise<void> {
      patchState(store, { loading: true, error: null, fixtures: [] });
      try {
        const fixtures = await firstValueFrom(
          api.competitionFixtures(sport, leagueId, season),
        );
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

Adapter `sports.store.spec.ts` : `FootballStore` → `SportsStore`, mocks `sportCompetitions`/`competitionFixtures`, appels `loadCompetitions('BASKETBALL')`, `loadFixtures('BASKETBALL', 12, '2025-2026')`, fixtures avec `sport: 'BASKETBALL'`, `season: '2025-2026'`, Competition avec `sport`/`season: string`.

- [ ] **Step 5: Vérifier**

Run: `cd web && export PATH="/opt/homebrew/opt/node/bin:$PATH" && npm test`
Expected: échecs restants uniquement dans dashboard/admin (corrigés Task 10) si le build des composants référence `FootballStore` — sinon PASS. Si dashboard casse la suite, faire Task 10 avant de relancer.

- [ ] **Step 6: Commit**

```bash
git add -A web/src
git commit -m "feat(web): multi-sport models, API routes and SportsStore"
```

---

### Task 10: Web — wizard avec étape sport + admin + icônes

**Files:**
- Modify: `web/src/app/features/dashboard/dashboard.component.ts`
- Modify: `web/src/app/features/group-admin/matches-panel.component.ts`

- [ ] **Step 1: Dashboard — étape sport**

Dans `dashboard.component.ts` :

1. Imports : remplacer `FootballStore` par `SportsStore` (`../../store/sports.store`), ajouter `import { SPORT_META, SPORTS } from '../../shared/sport';` et `Sport` aux models importés.
2. Propriétés :

```typescript
  readonly footballStore = inject(FootballStore);
```
devient
```typescript
  readonly sportsStore = inject(SportsStore);
  readonly selectedSport = signal<Sport | null>(null);
  protected readonly sports = SPORTS;
  protected readonly sportMeta = SPORT_META;
```

3. `next()` ne charge plus les compétitions (attend le choix du sport) :

```typescript
  next(): void {
    if (!this.name.trim()) {
      return;
    }
    if (this.mode === 'custom') {
      void this.create();
      return;
    }
    this.step.set(2);
  }

  selectSport(sport: Sport): void {
    this.selectedSport.set(sport);
    this.selectedCompetition.set(null);
    this.selectedFixtureIds.set(new Set());
    this.sportsStore.resetFixtures();
    void this.sportsStore.loadCompetitions(sport);
  }

  onCompetitionChange(competition: Competition | null): void {
    this.selectedCompetition.set(competition);
    this.selectedFixtureIds.set(new Set());
    const sport = this.selectedSport();
    if (competition && sport) {
      void this.sportsStore.loadFixtures(sport, competition.leagueId, competition.season);
    }
  }
```

4. Template étape 2 — grille de sports avant le `p-select` :

```html
<div class="grid grid-cols-3 gap-2">
  @for (sport of sports; track sport) {
    <button
      type="button"
      class="sc-card p-3 text-center cursor-pointer"
      [style.outline]="selectedSport() === sport ? '2px solid var(--sc-volt-400)' : 'none'"
      (click)="selectSport(sport)"
      [attr.data-testid]="'sport-' + sport"
    >
      <div class="text-2xl">{{ sportMeta[sport].icon }}</div>
      <div class="text-xs sc-muted">{{ sportMeta[sport].label }}</div>
    </button>
  }
</div>

@if (selectedSport()) {
  <!-- p-select compétitions + picker existants, en remplaçant footballStore par sportsStore -->
}
```

5. `create()` : payload compétition avec sport :

```typescript
        competition:
          this.mode === 'competition' && competition && this.selectedSport()
            ? {
                sport: this.selectedSport()!,
                leagueId: competition.leagueId,
                season: competition.season,
                name: competition.name,
              }
            : undefined,
```

6. `resetWizard()` : + `this.selectedSport.set(null);`, `footballStore` → `sportsStore`.
7. Carte de groupe : remplacer `🏆 {{ group.competitionName }}` par `{{ sportMeta[group.sport].icon }} {{ group.competitionName }}`.

- [ ] **Step 2: Admin — picker avec sport**

Dans `matches-panel.component.ts` :
- `FootballStore` → `SportsStore` (import, injection `footballStore` → `sportsStore`, occurrences template).
- `openPicker()` :

```typescript
  openPicker(): void {
    const summary = this.groupStore.summary();
    if (!summary?.competitionLeagueId || !summary.competitionSeason) {
      return;
    }
    this.selectedFixtureIds.set(new Set());
    this.showPicker.set(true);
    void this.sportsStore.loadFixtures(
      summary.sport,
      summary.competitionLeagueId,
      summary.competitionSeason,
    );
  }
```

- [ ] **Step 3: Vérifier**

Run: `cd web && export PATH="/opt/homebrew/opt/node/bin:$PATH" && npm test && npm run build 2>&1 | tail -2`
Expected: tests PASS, build OK.

- [ ] **Step 4: Commit**

```bash
git add web/src
git commit -m "feat(web): sport selection step in wizard and sport-aware admin picker"
```

---

### Task 11: Docs, version, vérification finale

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT.md`
- Modify: `api/package.json`, `web/package.json` (0.2.0 → 0.3.0)

- [ ] **Step 1: README**

Remplacer la section « Compétitions officielles (API-Football) » par :

```markdown
## Compétitions officielles (api-sports)

Les groupes peuvent être liés à une compétition en cours dans 9 sports
(football, basketball, rugby, volleyball, handball, hockey, baseball, NFL, AFL) :
matchs importés depuis [api-sports](https://api-sports.io/), scores live et
points calculés automatiquement.

1. Créer une clé sur https://dashboard.api-football.com (elle vaut pour toutes
   les APIs api-sports ; plan gratuit : 100 req/jour **par sport**).
2. La renseigner dans `api/.env` : `SPORTS_API_KEY=...`
3. Sans clé, les groupes « matchs personnalisés » fonctionnent normalement.
```

Dans `docs/PROJECT.md`, mettre à jour la phrase organisateur : « … lie le groupe à une compétition officielle d'un des 9 sports couverts (football, basketball, rugby…) ».

- [ ] **Step 2: Versions 0.3.0**

`api/package.json` et `web/package.json` : `"version": "0.3.0"`.

- [ ] **Step 3: Vérification complète**

```bash
cd api && npm test && npx dotenv -e .env.test -- npx jest --config ./test/jest-e2e.json --runInBand
cd ../web && export PATH="/opt/homebrew/opt/node/bin:$PATH" && npm test && npm run build 2>&1 | tail -2
```

Expected: tout PASS.

- [ ] **Step 4: Smoke test manuel**

`make dev-api` + `make dev-web` ; créer un groupe compétition → choisir 🏀 Basketball → vérifier que les compétitions chargent avec la vraie clé (quota : 1 req `/leagues`).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/PROJECT.md api/package.json web/package.json
git commit -m "docs: document multi-sport support and bump version to 0.3.0"
```
