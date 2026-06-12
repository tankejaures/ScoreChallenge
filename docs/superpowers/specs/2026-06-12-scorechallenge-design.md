# ScoreChallenge — Design

**Date** : 2026-06-12
**Statut** : validé

## Vision

Application web mobile-first permettant à des groupes (amis, collègues, communautés) de se challenger sur des pronostics de scores de matchs sportifs, avec classements et statistiques. Friction minimale : seul le créateur du groupe possède un compte, les participants rejoignent via un lien d'invitation et un code personnel.

## Stack technique

| Couche | Choix |
|---|---|
| Backend | NestJS (dernière version), API REST |
| ORM / BDD | Prisma + PostgreSQL (Docker en local) |
| Frontend | Angular (dernière version), PrimeNG + Tailwind CSS, NgRx Signal Store |
| Auth | JWT (créateurs et participants), bcrypt pour les mots de passe |
| Structure | Monorepo simple : `api/` + `web/`, Makefile racine |

> Note : la spec initiale prévoyait Firebase (AngularFire, Firestore, Firebase Auth). Décision actée de la remplacer par une API NestJS + PostgreSQL pour faciliter les évolutions futures et les calculs.

## Architecture

```
ScoreChallenge/
├── Makefile
├── docker-compose.yml      # PostgreSQL local
├── api/                    # NestJS + Prisma
└── web/                    # Angular + PrimeNG + Tailwind
```

## Modèle de données (Prisma)

```
User           id, email (unique), passwordHash, name, createdAt
Group          id, name, description?, inviteToken (unique, nanoid 12),
               ownerId → User,
               scoringExactScore (déf. 5), scoringCorrectOutcome (déf. 3),
               scoringOneTeamScore (déf. 1), createdAt
Participant    id, groupId → Group, name, code (unique par groupe),
               userId? → User (null = invité sans compte), createdAt
               @@unique([groupId, code])
Match          id, groupId → Group, teamA, teamB, kickoffAt,
               predictionDeadline, finalScoreA?, finalScoreB?, createdAt
Prediction     id, matchId → Match, participantId → Participant,
               scoreA, scoreB, editCount (0|1), lockedAt?,
               points? (null tant que résultat non saisi), updatedAt
               @@unique([matchId, participantId])
```

Décisions :

- Le créateur du groupe est aussi un `Participant` (lié via `userId`) : il joue comme les autres.
- Le barème de points est stocké sur `Group` et configurable (défauts 5/3/1).
- Le statut du match est **dérivé**, jamais saisi : `UPCOMING` (avant `kickoffAt`), `LIVE` (`kickoffAt` passé, pas de score final), `FINISHED` (score final saisi).
- `points` est figé sur chaque `Prediction` lors de la saisie du résultat ; classements et stats sont des **agrégations SQL à la volée** sur ces points (zéro dénormalisation).
- Correction d'un résultat par le créateur ⇒ recalcul automatique des points du match.

## API NestJS

### Modules

```
api/src/
├── auth/           # register, login, reset password, échange code → JWT
├── users/          # profil créateur
├── groups/         # CRUD groupes, lien invitation, barème
├── participants/   # gestion participants + génération codes
├── matches/        # CRUD matchs, saisie résultat
├── predictions/    # soumission/modification pronostics
├── stats/          # classement, stats individuelles, stats groupe
└── prisma/         # PrismaService partagé
```

### Authentification

Deux types de JWT, même `JwtAuthGuard` :

- **Créateur** : `{ sub: userId, role: 'owner' }` — login email/mot de passe (bcrypt).
- **Participant invité** : `{ sub: participantId, groupId, role: 'participant' }` — obtenu via `POST /groups/join` avec `inviteToken` + `code`. Durée 90 jours, stocké en localStorage.

Guards complémentaires :

- `GroupOwnerGuard` : actions réservées au créateur du groupe.
- `GroupMemberGuard` : un JWT participant ne donne accès qu'à son propre groupe.

### Endpoints

```
POST   /auth/register | /auth/login | /auth/forgot-password | /auth/reset-password
POST   /groups                          # créer groupe (devient owner + participant)
GET    /groups                          # mes groupes (owner)
GET    /groups/:id                      # détail (membres, barème)
PATCH  /groups/:id                      # nom, description, barème
POST   /groups/join                     # { inviteToken, code } → JWT participant
GET    /groups/invite/:token            # infos publiques du groupe (accueil invité)
POST   /groups/:id/participants         # ajouter participant (code auto-généré)
DELETE /groups/:id/participants/:pid
POST   /groups/:id/matches              # créer match
PATCH  /groups/:id/matches/:mid         # éditer match
POST   /groups/:id/matches/:mid/result  # saisir/corriger score final → calcul points
GET    /groups/:id/matches              # matchs + mon pronostic + (si terminé) tous
PUT    /matches/:mid/prediction         # soumettre/modifier mon pronostic
GET    /groups/:id/ranking              # classement
GET    /groups/:id/stats                # stats groupe
GET    /groups/:id/participants/:pid/stats   # stats individuelles
```

### Règles métier (appliquées côté serveur uniquement)

1. **Pronostic** : refusé si `now > predictionDeadline` ou si le score final est saisi. `editCount` : création = 0 ; une seule modification autorisée → `editCount = 1` + `lockedAt`. Toute tentative suivante → `403`.
2. **Visibilité** : les pronostics des autres participants sont invisibles tant que la deadline n'est pas passée (anti-copie).
3. **Calcul des points** (`ScoringService`, fonction pure, testée unitairement). Catégories exclusives, la plus haute l'emporte :
   - Score exact → `scoringExactScore` (déf. 5)
   - Bon vainqueur ou bon nul → `scoringCorrectOutcome` (déf. 3)
   - Bon score d'une seule équipe → `scoringOneTeamScore` (déf. 1)
   - Sinon → 0
4. **Codes participants** : 6 caractères alphanumériques sans caractères ambigus (pas de O/0, I/1), uniques par groupe. `inviteToken` : nanoid 12 caractères.
5. **Validation DTO** (`class-validator`) : scores entiers 0–99, `predictionDeadline ≤ kickoffAt`, noms non vides, etc.
6. **Limite de taille** : maximum **50 participants par groupe** (`MAX_PARTICIPANTS_PER_GROUP = 50`). `POST /groups/:id/participants` répond `409` au-delà ; message clair côté UI.
7. **Réinitialisation de mot de passe** : token à usage unique (validité 1 h) envoyé par email via nodemailer. En développement : Mailhog (Docker) ; en production : SMTP configurable par variables d'environnement.

### Statistiques (agrégations SQL)

- **Classement** : total points, matchs joués, pronostics corrects (points > 0), scores exacts, % réussite ; tri par points décroissants.
- **Stats individuelles** : total points, matchs pronostiqués, scores exacts, bons vainqueurs, taux de réussite, moyenne points/match, position dans le classement.
- **Stats groupe** : nombre de participants, nombre de matchs, moyenne de points par joueur, meilleur joueur, joueur avec le plus de scores exacts.

## Frontend Angular

### Structure

```
web/src/app/
├── core/             # ApiService, AuthService, interceptor JWT, guards
├── store/            # Signal Stores : auth, group, matches, predictions, ranking
├── features/
│   ├── auth/         # login, register, reset password
│   ├── dashboard/    # mes groupes (owner)
│   ├── group-admin/  # participants, matchs, résultats, barème
│   ├── join/         # page invité : lien → saisie code → entrée groupe
│   └── group/        # vue commune : matchs, pronostics, classement, stats
└── shared/           # composants UI (score input, badge statut, carte match…)
```

### Parcours clés (mobile first)

- **Invité** : ouvre `app.tld/join/:inviteToken` → voit le nom du groupe → entre son code → arrive directement sur la liste des matchs. JWT en localStorage : il revient sans ressaisir son code.
- **Pronostic** : carte match avec deux steppers de score, compte à rebours avant deadline, indication « 1 modification restante » puis « verrouillé ».
- **Classement** : podium visuel + tableau complet.
- **Owner** : mêmes écrans + onglet admin (participants avec codes copiables, création de matchs, saisie des résultats, configuration du barème).

### État

Un Signal Store par domaine, chargement via `ApiService`. Optimistic update sur la soumission de pronostic. Interceptor HTTP : ajoute le JWT, redirige vers login/join sur `401`.

### Exigence de design : premium

L'interface doit avoir un rendu **premium**, pas un habillage PrimeNG par défaut :

- Direction artistique propre : palette dédiée, typographie soignée, thème PrimeNG personnalisé (design tokens), dark mode envisageable.
- Composants clés travaillés : carte match avec compte à rebours, steppers de score tactiles, podium animé du classement, transitions fluides.
- Micro-interactions et feedback (confirmation de pronostic, mise à jour du classement).
- Mobile first irréprochable : zones tactiles généreuses, navigation par onglets en bas d'écran.
- La phase d'implémentation frontend utilisera le skill `frontend-design` pour garantir ce niveau de qualité.

## Tests

- **API** : unitaires sur `ScoringService` (toutes catégories + cas limites) et sur les règles de modification/verrouillage ; e2e (supertest) sur les parcours join → pronostic → résultat → classement, et la limite de 50 participants.
- **Web** : tests des stores et du composant de saisie de score.

## Outillage

Makefile racine auto-documenté : `make dev`, `make dev-api`, `make dev-web`, `make db-start`, `make db-migrate`, `make test`, `make build`, `make help`, `make status`.

## Hors périmètre MVP (évolutions futures prévues par l'architecture)

Compétitions multiples par groupe, notifications, badges, historique de saisons, classements mensuels, défis spéciaux, export de statistiques, partage sur réseaux sociaux. L'ajout ultérieur d'une entité `Competition` entre `Group` et `Match` est anticipé par la séparation des modules, sans rien implémenter aujourd'hui.
