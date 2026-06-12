# Multi-sports — choix du sport à la création d'un groupe compétition

**Date** : 2026-06-12
**Statut** : validé
**Prérequis** : intégration API-Football (`2026-06-12-football-api-integration-design.md`), branche `feat/football-api-integration`

## Objectif

Étendre l'intégration api-sports à 9 sports : à la création d'un groupe « compétition officielle », l'organisateur choisit d'abord le sport, puis la compétition, puis les matchs. Scores live et règlement automatique identiques au football.

## Sports retenus

| Sport | API | Base URL |
|---|---|---|
| FOOTBALL | v3 (existant) | `https://v3.football.api-sports.io` |
| AFL | v1 | `https://v1.afl.api-sports.io` |
| BASEBALL | v1 | `https://v1.baseball.api-sports.io` |
| BASKETBALL | v1 | `https://v1.basketball.api-sports.io` |
| HANDBALL | v1 | `https://v1.handball.api-sports.io` |
| HOCKEY | v1 | `https://v1.hockey.api-sports.io` |
| NFL | v1 | `https://v1.american-football.api-sports.io` |
| RUGBY | v1 | `https://v1.rugby.api-sports.io` |
| VOLLEYBALL | v1 | `https://v1.volleyball.api-sports.io` |

Exclus : **Formula-1** (course, pas de duel A–B), **MMA** (vainqueur sans score numérique), **API NBA dédiée** (la NBA est couverte par l'API Basketball générique).

Quota : 100 req/jour **par sport** sur le plan gratuit — le polling multi-sports ne partage pas son quota.

## Architecture — adaptateurs derrière une interface commune

Le module `api/src/football/` devient `api/src/sports/` :

```
api/src/sports/
├── sport.config.ts                  // par sport : baseUrl, durée de surveillance
├── sports-api.types.ts              // types bruts v3 + v1, NormalizedGame, CompetitionDto (+ sport)
├── fixture-status.util.ts           // mapping statuts : football (existant) + générique v1
├── adapters/
│   ├── sport-adapter.interface.ts   // SportApiAdapter
│   ├── football.adapter.ts          // v3 — code actuel déplacé
│   └── generic-v1.adapter.ts        // les 8 sports v1, parsing paramétré
├── sports-api.client.ts             // façade : route vers l'adaptateur du sport + caches
├── sports.service.ts                // compétitions, fixtures (upsert avec sport)
├── sports.controller.ts             // GET /sports/:sport/...
├── fixture-sync.service.ts          // cron : batch par sport, fenêtre par sport
└── sports.module.ts
```

### Interface `SportApiAdapter`

```typescript
interface WatchedFixtureRef {
  externalId: number;
  leagueId: number;
  season: string;
  kickoffAt: Date;
}

interface SportApiAdapter {
  getCompetitions(): Promise<CompetitionDto[]>;
  getGames(leagueId: number, season: string): Promise<NormalizedGame[]>;
  getLiveGames(refs: WatchedFixtureRef[]): Promise<NormalizedGame[]>;
}
```

`getLiveGames` : le football v3 supporte le batch `fixtures?ids=a-b-c` (chunks de 20) ; les APIs v1 n'ont pas de batch par ids → l'adaptateur générique groupe les refs par `(leagueId, season, date UTC du kickoff)` et fait une requête `/games?league=&season=&date=` par groupe, puis filtre sur les `externalId` demandés.

`NormalizedGame` = format pivot unique (seul format vu par le reste du code) :

```typescript
interface NormalizedGame {
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
  minute: number | null;   // null pour les sports v1 (pas de minute fiable)
  scoreA: number | null;
  scoreB: number | null;
}
```

### Adaptateur générique v1

Les 8 APIs v1 partagent la même forme (`/leagues`, `/games?league=&season=`, `/games?ids=`) avec des variations de détail gérées par le mapper :

- **Scores** : `scores.home` est tantôt un nombre (handball, rugby, volleyball…), tantôt un objet avec `total` (basketball, baseball, nfl…). Règle : nombre → direct ; objet → `.total` ; absent → null.
- **Statuts** : codes de période variables selon le sport (Q1, P1, S1, IN1…). Règle robuste :
  - `NS`, `TBD` → SCHEDULED
  - `FT`, `AET`, `AOT`, `AWD` → FINISHED
  - `PST`, `POST` → POSTPONED
  - `CANC`, `ABD`, `WO` → CANCELLED
  - **tout autre code → LIVE** (les codes de période sont innombrables ; un match ni programmé, ni fini, ni annulé est en cours)
- **Saisons** : `/leagues` v1 expose `seasons[].season` (pas `year` comme v3) ; certaines saisons sont des chaînes (« 2025-2026 ») et l'API exige cette valeur exacte en paramètre de requête → **`season` devient `String` partout** (Prisma `Fixture.season`, `Group.competitionSeason`, DTO, front). Football : « 2026 ».
- **Minute** : non fournie de façon fiable en v1 → `minute: null`, le front n'affiche la minute que si présente (déjà le cas).

### Fenêtre de surveillance par sport (`sport.config.ts`)

`kickoff − 5 min → kickoff + durée(sport)` : FOOTBALL 3 h, AFL 3 h 30, BASEBALL 4 h, BASKETBALL 2 h 30, HANDBALL 2 h, HOCKEY 3 h, NFL 4 h, RUGBY 2 h 30, VOLLEYBALL 2 h 30.

### Cron de synchronisation

Inchangé dans son principe ; il groupe les fixtures à surveiller **par sport** et fait un batch d'appels par sport via la façade. Règlement automatique identique (`MatchSettlementService`).

## Modèle de données

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

- `Group` : + `sport Sport @default(FOOTBALL)` (significatif seulement en mode compétition).
- `Fixture` : + `sport Sport @default(FOOTBALL)` ; remplacement de `externalId @unique` par `@@unique([sport, externalId])` (les ids se chevauchent entre APIs).
- Données existantes : les defaults migrent tout en FOOTBALL, zéro rupture.

## API HTTP

- `GET /sports/:sport/competitions` — compétitions en cours du sport.
- `GET /sports/:sport/competitions/:leagueId/fixtures?season=` — calendrier (upsert en DB avec le sport).
- Création de groupe : `competition { sport, leagueId, season, name }`.
- Import : inchangé (`POST /groups/:id/matches/import`), validation fixture.sport === group.sport en plus de league/season.
- Les anciennes routes `/football/*` sont **supprimées** (pas encore en production, aucune compat à maintenir).
- Paramètre `:sport` validé contre l'enum (pipe de validation), sinon 400.

## Environnement

- `FOOTBALL_API_KEY` → renommée `SPORTS_API_KEY` (une seule clé api-sports pour toutes les APIs).
- `FOOTBALL_API_URL` supprimée : les base URLs vivent dans `sport.config.ts` ; les tests mockent le client/adaptateurs.

## Frontend

- **Wizard étape 2** : d'abord une grille de sports (icône + nom : ⚽ Football, 🏀 Basketball, 🏉 Rugby, 🏐 Volleyball, 🏒 Hockey, ⚾ Baseball, 🏈 NFL, 🦘 AFL, 🤾 Handball), puis le sélecteur de compétition du sport choisi, puis le `FixturePickerComponent` (inchangé).
- `FootballStore` → `SportsStore` : `loadCompetitions(sport)`, `loadFixtures(sport, leagueId, season)`.
- `ApiService` : routes `/sports/:sport/...`, payload création de groupe avec `sport`.
- Carte de groupe (dashboard) et admin : icône du sport à côté du nom de compétition.
- Cartes de match : inchangées (déjà génériques ; minute affichée seulement si fournie).
- Admin « Ajouter des matchs » : utilise le sport du summary (`GroupSummary` + `sport`).

## Tests

- Unit API : mapping statuts v1 (fallback LIVE), parsing scores (nombre direct vs objet.total), parsing saisons (« 2025-2026 » → 2025), config des fenêtres, routage de la façade vers le bon adaptateur.
- e2e API : scénario complet avec un groupe BASKETBALL (adaptateurs mockés) — import, live, règlement auto ; non-régression de toute la suite football existante.
- Unit web : `SportsStore`, wizard avec étape sport.

## Hors périmètre

- Formula-1, MMA, API NBA dédiée.
- Statistiques spécifiques par sport (quarts-temps, manches, sets détaillés).
- Pronostics au-delà du score final A–B.
