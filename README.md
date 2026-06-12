# ScoreChallenge

Application de pronostics de matchs entre amis, collègues et communautés.

- **Documentation produit** : [docs/PROJECT.md](docs/PROJECT.md)
- **Design technique** : [docs/superpowers/specs/2026-06-12-scorechallenge-design.md](docs/superpowers/specs/2026-06-12-scorechallenge-design.md)

## Stack

- `api/` — NestJS + Prisma + PostgreSQL (JWT, scoring, stats SQL)
- `web/` — Angular 21 + PrimeNG + Tailwind CSS + NgRx Signal Store (architecture ApiService → stores → composants)

## Démarrage rapide

    make db-start      # PostgreSQL + Mailhog (Docker)
    make install       # dépendances api + web
    make db-migrate    # migrations Prisma
    make dev-api       # API sur http://localhost:3000
    make dev-web       # Frontend sur http://localhost:4200 (proxy /api → API)

## Compétitions officielles (API-Football)

Les groupes peuvent être liés à une compétition en cours (Coupe du Monde, Ligue 1…) :
matchs importés depuis [API-Football](https://www.api-football.com/), scores live et
points calculés automatiquement.

1. Créer une clé sur https://dashboard.api-sports.io (plan gratuit : 100 req/jour,
   limité aux saisons 2021-2023 ; plan payant requis pour les compétitions courantes).
2. La renseigner dans `api/.env` : `FOOTBALL_API_KEY=...`
3. Sans clé, les groupes « matchs personnalisés » fonctionnent normalement.

## Parcours de démo

1. Créer un compte organisateur sur `http://localhost:4200/register`.
2. Créer un groupe, ajouter des participants (un code à 6 caractères est généré pour chacun).
3. Créer des matchs (équipes, coup d'envoi, date limite de pronostic).
4. Partager le lien `http://localhost:4200/join/<inviteToken>` + le code personnel de chaque participant.
5. Chacun pronostique ; après le match, l'organisateur saisit le score final → points et classement automatiques.

## Tests

    make db-test-create   # une seule fois
    make test             # unit API + e2e API + unit web

Toutes les commandes : `make help`.

> Note : PostgreSQL est exposé sur le port **5435** en local (5432 était occupé).
