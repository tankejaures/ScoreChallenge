# ScoreChallenge

Application de pronostics de matchs entre amis, collègues et communautés.

- **Documentation produit** : [docs/PROJECT.md](docs/PROJECT.md)
- **Design technique** : [docs/superpowers/specs/2026-06-12-scorechallenge-design.md](docs/superpowers/specs/2026-06-12-scorechallenge-design.md)

## Démarrage rapide

    make db-start      # PostgreSQL + Mailhog (Docker)
    make install       # dépendances
    make db-migrate    # migrations Prisma
    make dev-api       # API sur http://localhost:3000

## Tests

    make db-test-create   # une seule fois
    make test

Toutes les commandes : `make help`.
