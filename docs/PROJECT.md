# ScoreChallenge — Document de référence du projet

**Date** : 2026-06-12
**Document technique associé** : [Design](superpowers/specs/2026-06-12-scorechallenge-design.md)

---

## 1. L'idée en une phrase

ScoreChallenge permet à un groupe de personnes (amis, collègues, famille, association, communauté) de se challenger autour de pronostics de matchs sportifs : chacun prédit les scores, gagne des points selon la précision de ses pronostics, et se compare aux autres via un classement et des statistiques.

---

## 2. Le problème résolu

Pendant une Coupe du monde, une CAN ou une saison de championnat, les groupes d'amis ou de collègues improvisent souvent leurs concours de pronostics sur WhatsApp ou Excel :

- Saisie manuelle des pronostics, perdus dans les conversations.
- Calcul des points fastidieux et source de disputes.
- Pas de classement en temps réel, pas de statistiques.
- Tricherie possible (modifier son pronostic après le coup d'envoi).

ScoreChallenge automatise tout cela avec une friction minimale : **un seul membre du groupe (l'organisateur) crée un compte ; tous les autres rejoignent avec un simple lien et un code personnel.**

---

## 3. Les acteurs

### L'organisateur (créateur du groupe)

Seule personne obligée d'avoir un compte (email + mot de passe). Il :

- crée le groupe, lui donne un nom et une description ;
- ajoute les participants (juste leur nom) et reçoit un code unique pour chacun ;
- partage le lien d'invitation du groupe ;
- crée les matchs et saisit les scores officiels ;
- configure le barème de points s'il veut s'écarter des valeurs par défaut ;
- **joue aussi** : il est participant comme les autres.

### Le participant invité

Aucun compte requis. Il :

- ouvre le lien d'invitation partagé par l'organisateur ;
- entre son code personnel (ex. `K7KM3N`) ;
- accède aussitôt aux matchs, soumet ses pronostics, consulte le classement.

Son code est son identité dans le groupe. Son appareil le mémorise : il ne le ressaisit pas à chaque visite.

---

## 4. Parcours type : « La Coupe du monde au bureau »

1. **Lundi** — Aline crée un compte et le groupe « CdM 2026 — Open Space », ajoute ses 12 collègues par leur prénom. L'application génère un code par personne.
2. Elle partage le lien du groupe sur le chat d'équipe et envoie à chacun son code en privé.
3. **Mardi** — Elle crée les matchs de la semaine : équipes, date/heure du coup d'envoi, date limite de pronostic.
4. Chaque collègue ouvre le lien, entre son code et pronostique : « France 2 – 1 Brésil ».
5. **Avant la deadline** — Marc change d'avis et modifie son pronostic. C'est sa seule modification autorisée : son pronostic est désormais verrouillé.
6. **Après le match** — Aline saisit le score officiel : France 3 – 2 Brésil. Les points sont calculés instantanément, le classement se met à jour.
7. Tout le monde consulte le classement, les statistiques, et chambre le dernier. La semaine suivante, on recommence.

---

## 5. Les règles du jeu

### Pronostics

- Un pronostic = un score pour chaque équipe (ex. `2 – 1`).
- Soumission possible jusqu'à la **date limite** fixée par l'organisateur.
- **Une seule modification autorisée** après le premier enregistrement ; ensuite le pronostic est verrouillé.
- Aucun changement possible après la date limite ni après la saisie du score final.
- Les pronostics des autres restent **cachés jusqu'à la date limite** (anti-copie).

### Barème de points (configurable par groupe)

| Résultat du pronostic | Points (défaut) | Exemple (résultat réel : 3 – 2) |
|---|---|---|
| **Score exact** | 5 | Pronostic 3 – 2 |
| **Bon vainqueur ou bon nul** | 3 | Pronostic 2 – 1 (victoire équipe A prédite) |
| **Bon score d'une seule équipe** | 1 | Pronostic 0 – 2 (vainqueur faux, mais le 2 de l'équipe B est juste) |
| **Tout faux** | 0 | Pronostic 1 – 0 |

Les catégories sont exclusives et hiérarchiques : on marque les points de la meilleure catégorie atteinte, une seule fois. Exemple : pronostic 3 – 1 pour un résultat 3 – 2 = bon vainqueur (3 pts), même si le score de l'équipe A est aussi juste — la catégorie la plus haute l'emporte.

### Cycle de vie d'un match

```
À venir ──(coup d'envoi)──► En cours ──(score final saisi)──► Terminé
```

Le statut est automatique. À la saisie du score final : pronostics verrouillés, points calculés, classement mis à jour.

### Limites

- Maximum **50 participants par groupe**.
- Scores entre 0 et 99.
- La date limite de pronostic ne peut pas dépasser le coup d'envoi.

---

## 6. Classements et statistiques

### Classement du groupe

Trié par points décroissants, il affiche pour chaque participant : total de points, matchs joués, pronostics corrects, scores exacts, pourcentage de réussite.

### Statistiques individuelles

Profil de chaque participant : total de points, matchs pronostiqués, scores exacts, bons vainqueurs, taux de réussite, moyenne de points par match, position au classement.

### Statistiques du groupe

Nombre de participants, nombre de matchs, moyenne de points par joueur, meilleur joueur, joueur avec le plus de scores exacts.

---

## 7. Principes d'expérience utilisateur

- **Mobile first** : on pronostique depuis son téléphone, dans le métro, juste avant la deadline.
- **Friction minimale** : rejoindre un groupe = un lien + un code. Pas de formulaire d'inscription pour les invités.
- **Motivant** : compte à rebours avant deadline, podium visuel, statistiques qui alimentent les discussions.
- **Honnête par construction** : verrouillages et calculs côté serveur, impossible de tricher.

---

## 8. Stack technique (résumé)

| Couche | Technologie |
|---|---|
| Backend | NestJS (API REST) |
| Base de données | PostgreSQL + Prisma |
| Frontend | Angular + PrimeNG + Tailwind CSS + NgRx Signal Store |
| Authentification | JWT (organisateur : email/mot de passe ; invité : code → JWT scopé au groupe) |
| Structure | Monorepo : `api/` + `web/` + Makefile |

Détails complets dans le [document de design](superpowers/specs/2026-06-12-scorechallenge-design.md).

---

## 9. Périmètre

### MVP (version 1)

Comptes organisateurs, groupes, participants par code, matchs, pronostics avec modification unique, saisie des résultats, calcul des points configurable, classement, statistiques individuelles et de groupe.

### Évolutions futures (architecture prête, rien d'implémenté)

- Plusieurs compétitions dans un même groupe (Coupe du monde, CAN, Ligue des Champions, championnats…).
- Notifications (rappels avant deadline, résultats).
- Badges et récompenses.
- Historique des saisons, classements mensuels.
- Défis spéciaux entre participants.
- Export des statistiques, partage sur les réseaux sociaux.

---

## 10. Objectif final

Une plateforme légère et conviviale qui entretient une compétition amicale : pronostiquer prend dix secondes, le classement est toujours juste, et c'est l'application — pas l'organisateur — qui tranche les débats.
