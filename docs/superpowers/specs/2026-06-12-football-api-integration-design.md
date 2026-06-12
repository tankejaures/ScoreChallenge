# Intégration API-Football — groupes liés à une compétition et résultats live

**Date** : 2026-06-12
**Statut** : validé

## Objectif

Permettre, à la création d'un groupe, de le lier à une compétition en cours (ex. Coupe du Monde) : les matchs du challenge sont alors importés depuis API-Football, les scores finaux sont validés automatiquement et les points calculés sans intervention de l'organisateur. Les groupes « libres » (matchs saisis à la main) restent inchangés. L'onglet matchs affiche les scores en temps réel.

## Décisions de cadrage

- **Validation des scores** : automatique pour les matchs liés à l'API (aucune confirmation de l'organisateur).
- **Mode exclusif** : un groupe est soit « compétition » (matchs importés uniquement), soit « libre » (saisie manuelle uniquement). Choix définitif à la création.
- **Page résultats** : pas de nouvelle page ; l'onglet matchs du groupe est enrichi (badge LIVE, score en cours, minute de jeu).
- **Ajout de matchs a posteriori** : autorisé à tout moment depuis l'admin du groupe (indispensable pour les phases à élimination directe).
- **Fournisseur** : API-Football (api-sports.io), REST. Tier gratuit (100 req/jour) pour le développement — limité aux saisons 2021-2023, donc tests sur la CdM 2022 ; plan payant (~19 €/mois) requis pour suivre une compétition courante en production.

## Architecture retenue

Polling backend mutualisé + cache DB (approche A) :

- Seul le backend parle à API-Football (clé jamais exposée au client).
- Les fixtures sont stockées en DB dans une table partagée : une ligne par match réel, quel que soit le nombre de groupes qui le suivent → 1 requête de polling sert tous les groupes.
- Le frontend interroge uniquement notre API, avec un rafraîchissement périodique côté client.

Approches rejetées : appels directs depuis Angular (clé exposée, quota explosé), WebSockets temps réel (sur-ingénierie, 60 s de latence suffisent pour des pronostics).

## Modèle de données

Nouvelle table `Fixture` (cache partagé des matchs API) :

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
  externalId Int           @unique // id API-Football
  leagueId   Int
  season     Int
  round      String? // « Group A - 1 », « Quarter-finals »…
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
}
```

Évolutions des tables existantes :

- `Group` : ajout de `competitionLeagueId Int?`, `competitionSeason Int?`, `competitionName String?`. Renseignés ⇒ groupe en mode « compétition », sinon mode « libre ». Exclusivité validée côté service.
- `Match` : ajout de `fixtureId String?` (relation vers `Fixture`) avec `@@unique([groupId, fixtureId])` (pas deux fois le même match dans un groupe). `teamA`, `teamB`, `kickoffAt` sont copiés depuis la fixture à l'import ; `predictionDeadline` = coup d'envoi par défaut.

## Backend — module `football`

### `FootballApiClient` (seul service à parler à API-Football)

- Configuration : `FOOTBALL_API_KEY` et `FOOTBALL_API_URL` dans `api/.env` (URL surchargeable pour les tests).
- Trois appels :
  - `getCurrentCompetitions()` — ligues/coupes en cours, cache mémoire 24 h ;
  - `getFixtures(leagueId, season)` — calendrier d'une compétition, cache 1 h ;
  - `getLiveFixturesByIds(ids)` — état live, 1 requête pour jusqu'à 20 matchs.
- Gestion d'erreur : API injoignable ou quota dépassé → log warning, les données DB restent servies, retry au tick suivant. Aucune erreur propagée à l'utilisateur final.

### `FixtureSyncService` (cron `@nestjs/schedule`)

- Toutes les 60 s : sélectionne en DB les fixtures « à surveiller » = liées à au moins un match de groupe ET dans la fenêtre `kickoffAt − 5 min` → `kickoffAt + 3 h`, non terminées.
- Aucune fixture à surveiller → aucune requête API (quota préservé hors jours de match).
- Sinon → requête batch par ids → mise à jour `status`, `minute`, `scoreA/B`.
- Passage à `FINISHED` → règlement automatique : copie du score dans `finalScoreA/finalScoreB` de tous les `Match` liés + calcul des points (réutilise la logique de scoring existante de `matches.service`).
- `POSTPONED` / `CANCELLED` → statut affiché, l'organisateur peut supprimer le match du groupe.

### Endpoints (auth organisateur)

- `GET /football/competitions` — compétitions en cours (sélecteur du wizard).
- `GET /football/competitions/:leagueId/fixtures?season=` — calendrier pour la sélection de matchs (upsert des fixtures en DB au passage).
- `POST /groups/:id/matches/import` body `{ fixtureIds: string[] }` — crée les matchs du groupe depuis les fixtures.
- Création de groupe : accepte un objet optionnel `competition { leagueId, season, name }`.

### Garde-fous

- Groupe « compétition » : création manuelle de match refusée.
- Groupe « libre » : import de fixtures refusé.
- Saisie manuelle de score refusée sur un match lié à une fixture.

## Frontend — Angular

### Création de groupe (dashboard), en 2 étapes

1. Infos groupe + choix du mode : « Compétition officielle » / « Matchs personnalisés » (choix définitif, mentionné dans l'UI).
2. Si compétition : sélecteur de compétition (liste des ligues en cours, logo + nom), puis sélecteur de matchs — liste groupée par journée/round, checkbox par match (équipes, logos, date), bouton « tout sélectionner » par round. Mode libre : comportement actuel inchangé.

### Admin du groupe (mode compétition)

- Bouton « Ajouter des matchs » → même sélecteur de matchs, fixtures déjà importées masquées.
- Formulaire de match manuel masqué ; saisie de score finale masquée sur les matchs liés (remplacée par un badge « score automatique »).

### Onglet matchs enrichi (la page « résultats »)

- Match à venir : affichage actuel + logos des équipes.
- Match en cours : badge `LIVE` animé, score actuel, minute de jeu.
- Match terminé : score final + points gagnés (existant).
- Reporté / annulé : badge explicite.
- Rafraîchissement : le store matches re-fetch toutes les 60 s uniquement si au moins un match est live et que l'onglet est visible (`document.visibilityState`).

### Stores

- `MatchesStore` existant étendu avec les champs live.
- Nouveau `FootballStore` léger pour compétitions/fixtures du wizard.
- Pattern existant conservé : ApiService → store → composants.

## Tests

- Unit API : mapping des statuts API-Football → `FixtureStatus`, calcul de la fenêtre de surveillance, règlement automatique (score → points), garde-fous du mode exclusif.
- e2e API : import de matchs + cycle live → finished avec `FootballApiClient` mocké.
- Unit web : wizard (étapes, sélection de matchs), affichage live.

## Hors périmètre

- Événements détaillés du match (buts, cartons, compositions).
- Page globale du calendrier d'une compétition hors groupe.
- WebSockets / SSE côté front (polling 60 s suffisant).
- Cotes, statistiques avancées (xG, possession).
