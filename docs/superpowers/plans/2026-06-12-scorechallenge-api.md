# ScoreChallenge API — Implementation Plan (Plan 1/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'infrastructure monorepo et l'API NestJS complète de ScoreChallenge (auth, groupes, participants par code, matchs, pronostics, scoring, statistiques), testée unitairement et en e2e.

**Architecture:** Monorepo `api/` + `web/` (web en Plan 2). API NestJS modulaire (auth, groups, participants, matches, predictions, stats), Prisma + PostgreSQL, JWT pour créateurs et invités, règles métier exclusivement côté serveur. Stats par agrégation SQL à la volée.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL 16 (Docker), @nestjs/jwt, bcrypt, class-validator, nodemailer + Mailhog, Jest + supertest.

**Spec:** `docs/superpowers/specs/2026-06-12-scorechallenge-design.md`

**Plan 2 (à rédiger après exécution de ce plan) :** frontend Angular + PrimeNG + Tailwind + Signal Store, design premium via skill `frontend-design`.

---

## Conventions globales

- Toutes les commandes s'exécutent depuis la racine du repo sauf mention contraire.
- Messages de commit : Conventional Commits, en anglais.
- Chaque tâche se termine par un commit. Tests verts obligatoires avant commit.

---

### Task 1: Scaffolding monorepo (Docker, Makefile, NestJS)

**Files:**
- Create: `docker-compose.yml`
- Create: `Makefile`
- Create: `.gitignore`
- Create: `api/` (scaffold NestJS CLI)

- [ ] **Step 1: Créer docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: scorechallenge-db
    environment:
      POSTGRES_USER: scorechallenge
      POSTGRES_PASSWORD: scorechallenge
      POSTGRES_DB: scorechallenge
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  mailhog:
    image: mailhog/mailhog
    container_name: scorechallenge-mail
    ports:
      - '1025:1025'
      - '8025:8025'

volumes:
  pgdata:
```

- [ ] **Step 2: Créer .gitignore racine**

```gitignore
node_modules/
dist/
.env
.env.test
*.log
.DS_Store
coverage/
```

- [ ] **Step 3: Scaffolder l'API NestJS**

Run: `npx @nestjs/cli@latest new api --package-manager npm --skip-git`
Expected: dossier `api/` créé avec structure NestJS standard.

- [ ] **Step 4: Créer le Makefile**

```makefile
API_DIR := api
WEB_DIR := web

.DEFAULT_GOAL := help

## ----- Aide -----

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

## ----- Installation -----

install: ## Installe les dépendances
	cd $(API_DIR) && npm install

## ----- Infrastructure -----

db-start: ## Démarre PostgreSQL + Mailhog
	docker compose up -d

db-stop: ## Arrête les conteneurs
	docker compose down

db-migrate: ## Applique les migrations Prisma
	cd $(API_DIR) && npx prisma migrate dev

db-test-create: ## Crée la base de test
	docker compose exec postgres createdb -U scorechallenge scorechallenge_test || true

## ----- Développement -----

dev-api: ## Lance l'API en mode watch
	cd $(API_DIR) && npm run start:dev

## ----- Tests -----

test-api: ## Tests unitaires API
	cd $(API_DIR) && npm test

test-e2e: ## Tests e2e API
	cd $(API_DIR) && npm run test:e2e

test: test-api test-e2e ## Tous les tests

## ----- Build -----

build: ## Build de l'API
	cd $(API_DIR) && npm run build

## ----- État -----

status: ## État des services Docker
	docker compose ps
```

- [ ] **Step 5: Vérifier le démarrage de l'infra**

Run: `make db-start && make status`
Expected: conteneurs `scorechallenge-db` et `scorechallenge-mail` `Up`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml Makefile .gitignore api
git commit -m "chore: scaffold monorepo with NestJS api, Docker infra and Makefile"
```

---

### Task 2: Prisma — schéma complet et migration initiale

**Files:**
- Create: `api/prisma/schema.prisma`
- Create: `api/.env` (non commité)
- Create: `api/.env.example`

- [ ] **Step 1: Installer Prisma**

Run (dans `api/`): `npm install prisma @prisma/client && npx prisma init`

- [ ] **Step 2: Écrire le schéma complet**

`api/prisma/schema.prisma` :

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String               @id @default(cuid())
  email        String               @unique
  passwordHash String
  name         String
  createdAt    DateTime             @default(now())
  groups       Group[]
  participants Participant[]
  resetTokens  PasswordResetToken[]
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  token     String    @unique
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}

model Group {
  id                    String        @id @default(cuid())
  name                  String
  description           String?
  inviteToken           String        @unique
  ownerId               String
  owner                 User          @relation(fields: [ownerId], references: [id])
  scoringExactScore     Int           @default(5)
  scoringCorrectOutcome Int           @default(3)
  scoringOneTeamScore   Int           @default(1)
  createdAt             DateTime      @default(now())
  participants          Participant[]
  matches               Match[]
}

model Participant {
  id          String       @id @default(cuid())
  groupId     String
  group       Group        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name        String
  code        String
  userId      String?
  user        User?        @relation(fields: [userId], references: [id])
  createdAt   DateTime     @default(now())
  predictions Prediction[]

  @@unique([groupId, code])
}

model Match {
  id                 String       @id @default(cuid())
  groupId            String
  group              Group        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  teamA              String
  teamB              String
  kickoffAt          DateTime
  predictionDeadline DateTime
  finalScoreA        Int?
  finalScoreB        Int?
  createdAt          DateTime     @default(now())
  predictions        Prediction[]
}

model Prediction {
  id            String      @id @default(cuid())
  matchId       String
  match         Match       @relation(fields: [matchId], references: [id], onDelete: Cascade)
  participantId String
  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  scoreA        Int
  scoreB        Int
  editCount     Int         @default(0)
  lockedAt      DateTime?
  points        Int?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([matchId, participantId])
}
```

- [ ] **Step 3: Configurer les variables d'environnement**

`api/.env` (et copie `api/.env.example` sans secrets réels) :

```env
DATABASE_URL="postgresql://scorechallenge:scorechallenge@localhost:5432/scorechallenge"
JWT_SECRET="change-me-in-production"
SMTP_HOST="localhost"
SMTP_PORT=1025
MAIL_FROM="ScoreChallenge <noreply@scorechallenge.local>"
WEB_BASE_URL="http://localhost:4200"
```

- [ ] **Step 4: Créer la migration initiale**

Run (dans `api/`): `npx prisma migrate dev --name init`
Expected: `Your database is now in sync with your schema.` + dossier `api/prisma/migrations/.../`.

- [ ] **Step 5: Commit**

```bash
git add api/prisma api/.env.example api/package.json api/package-lock.json
git commit -m "feat: add Prisma schema and initial migration"
```

---

### Task 3: PrismaModule global + configuration de l'app

**Files:**
- Create: `api/src/prisma/prisma.service.ts`
- Create: `api/src/prisma/prisma.module.ts`
- Create: `api/src/setup-app.ts`
- Modify: `api/src/main.ts`
- Modify: `api/src/app.module.ts`

- [ ] **Step 1: PrismaService et PrismaModule**

`api/src/prisma/prisma.service.ts` :

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

`api/src/prisma/prisma.module.ts` :

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 2: setup-app partagé (main + tests e2e)**

`api/src/setup-app.ts` :

```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';

export function setupApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({ origin: process.env.WEB_BASE_URL ?? true });
  return app;
}
```

`api/src/main.ts` :

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
```

- [ ] **Step 3: Installer config + validation et brancher AppModule**

Run (dans `api/`): `npm install @nestjs/config class-validator class-transformer`

`api/src/app.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
})
export class AppModule {}
```

(Supprimer `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts` générés par le scaffold.)

- [ ] **Step 4: Vérifier que l'app démarre**

Run (dans `api/`): `npm run build`
Expected: build sans erreur.

- [ ] **Step 5: Commit**

```bash
git add api/src api/package.json api/package-lock.json
git commit -m "feat: add global PrismaModule, config and app setup"
```

---

### Task 4: Utilitaires de génération de codes (TDD)

**Files:**
- Create: `api/src/common/codes.util.ts`
- Test: `api/src/common/codes.util.spec.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

`api/src/common/codes.util.spec.ts` :

```typescript
import { CODE_ALPHABET, generateInviteToken, generateParticipantCode } from './codes.util';

describe('codes.util', () => {
  it('generates 6-char participant codes from unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateParticipantCode();
      expect(code).toHaveLength(6);
      for (const char of code) {
        expect(CODE_ALPHABET).toContain(char);
      }
    }
  });

  it('alphabet excludes ambiguous characters O, 0, I, 1', () => {
    expect(CODE_ALPHABET).not.toMatch(/[O0I1]/);
  });

  it('generates 12-char lowercase invite tokens', () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(12);
    expect(token).toBe(token.toLowerCase());
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `npm test -- codes.util`
Expected: FAIL — `Cannot find module './codes.util'`.

- [ ] **Step 3: Implémenter**

`api/src/common/codes.util.ts` :

```typescript
import { randomInt } from 'crypto';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomFromAlphabet(length: number): string {
  return Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

export function generateParticipantCode(): string {
  return randomFromAlphabet(6);
}

export function generateInviteToken(): string {
  return randomFromAlphabet(12).toLowerCase();
}
```

- [ ] **Step 4: Vérifier le succès**

Run (dans `api/`): `npm test -- codes.util`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/common
git commit -m "feat: add participant code and invite token generators"
```

---

### Task 5: Auth — register/login + guard JWT global

**Files:**
- Create: `api/src/auth/auth.module.ts`, `auth.service.ts`, `auth.controller.ts`
- Create: `api/src/auth/dto/register.dto.ts`, `dto/login.dto.ts`
- Create: `api/src/auth/jwt-auth.guard.ts`, `public.decorator.ts`, `jwt-payload.interface.ts`
- Modify: `api/src/app.module.ts`
- Create: `api/test/test-utils.ts`, `api/.env.test`
- Test: `api/test/auth.e2e-spec.ts`

- [ ] **Step 1: Installer les dépendances**

Run (dans `api/`): `npm install @nestjs/jwt bcrypt && npm install -D @types/bcrypt dotenv-cli`

- [ ] **Step 2: Préparer l'infra de test e2e**

`api/.env.test` :

```env
DATABASE_URL="postgresql://scorechallenge:scorechallenge@localhost:5432/scorechallenge_test"
JWT_SECRET="test-secret"
SMTP_HOST="localhost"
SMTP_PORT=1025
MAIL_FROM="ScoreChallenge <noreply@scorechallenge.local>"
WEB_BASE_URL="http://localhost:4200"
```

Dans `api/package.json`, scripts :

```json
{
  "pretest:e2e": "dotenv -e .env.test -- prisma db push --force-reset --skip-generate",
  "test:e2e": "dotenv -e .env.test -- jest --config ./test/jest-e2e.json --runInBand"
}
```

Run: `make db-test-create` (crée la base `scorechallenge_test`).

`api/test/test-utils.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  await app.init();
  return app;
}

export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$transaction([
    prisma.prediction.deleteMany(),
    prisma.match.deleteMany(),
    prisma.participant.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.group.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
```

- [ ] **Step 3: Écrire le test e2e qui échoue**

`api/test/auth.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb } from './test-utils';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  const credentials = { email: 'aline@test.io', password: 'password123', name: 'Aline' };

  it('registers a user and returns a token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(credentials.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email with 409', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(credentials).expect(201);
    await request(app.getHttpServer()).post('/auth/register').send(credentials).expect(409);
  });

  it('rejects invalid registration payload with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '' })
      .expect(400);
  });

  it('logs in with valid credentials', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(credentials).expect(201);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(201);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password with 401', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(credentials).expect(201);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' })
      .expect(401);
  });
});
```

- [ ] **Step 4: Vérifier l'échec**

Run (dans `api/`): `npm run test:e2e -- auth`
Expected: FAIL — 404 sur `/auth/register`.

- [ ] **Step 5: Implémenter le module auth**

`api/src/auth/jwt-payload.interface.ts` :

```typescript
export interface OwnerJwtPayload {
  sub: string; // userId
  role: 'owner';
}

export interface ParticipantJwtPayload {
  sub: string; // participantId
  groupId: string;
  role: 'participant';
}

export type JwtPayload = OwnerJwtPayload | ParticipantJwtPayload;
```

`api/src/auth/public.decorator.ts` :

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`api/src/auth/jwt-auth.guard.ts` :

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      request.user = this.jwtService.verify<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

`api/src/auth/dto/register.dto.ts` :

```typescript
import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
```

`api/src/auth/dto/login.dto.ts` :

```typescript
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}
```

`api/src/auth/auth.service.ts` :

```typescript
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OwnerJwtPayload } from './jwt-payload.interface';

const BCRYPT_ROUNDS = 10;
const OWNER_TOKEN_TTL = '7d';

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });
    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    return this.buildAuthResult(user);
  }

  private buildAuthResult(user: { id: string; email: string; name: string }): AuthResult {
    const payload: OwnerJwtPayload = { sub: user.id, role: 'owner' };
    return {
      token: this.jwtService.sign(payload, { expiresIn: OWNER_TOKEN_TTL }),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
```

`api/src/auth/auth.controller.ts` :

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService, AuthResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }
}
```

`api/src/auth/auth.module.ts` :

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
```

Ajouter `AuthModule` aux imports de `AppModule`.

- [ ] **Step 6: Vérifier le succès**

Run (dans `api/`): `npm run test:e2e -- auth`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add api
git commit -m "feat: add email/password auth with global JWT guard"
```

---

### Task 6: Réinitialisation de mot de passe (Mailhog)

**Files:**
- Create: `api/src/mail/mail.service.ts`, `mail.module.ts`
- Create: `api/src/auth/dto/forgot-password.dto.ts`, `dto/reset-password.dto.ts`
- Modify: `api/src/auth/auth.service.ts`, `auth.controller.ts`
- Test: `api/test/password-reset.e2e-spec.ts`

- [ ] **Step 1: Installer nodemailer**

Run (dans `api/`): `npm install nodemailer && npm install -D @types/nodemailer`

- [ ] **Step 2: Écrire le test e2e qui échoue**

`api/test/password-reset.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './test-utils';

describe('Password reset (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  const credentials = { email: 'aline@test.io', password: 'password123', name: 'Aline' };

  it('creates a reset token and allows password change', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(credentials).expect(201);
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: credentials.email })
      .expect(204);

    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: stored.token, password: 'newpassword456' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: 'newpassword456' })
      .expect(201);
  });

  it('returns 204 even for unknown email (no account enumeration)', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'unknown@test.io' })
      .expect(204);
  });

  it('rejects reused token with 400', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(credentials).expect(201);
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: credentials.email })
      .expect(204);
    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: stored.token, password: 'newpassword456' })
      .expect(204);
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: stored.token, password: 'anotherpass789' })
      .expect(400);
  });
});
```

- [ ] **Step 3: Vérifier l'échec**

Run (dans `api/`): `npm run test:e2e -- password-reset`
Expected: FAIL — 404 sur `/auth/forgot-password`.

- [ ] **Step 4: Implémenter MailService et les endpoints**

`api/src/mail/mail.service.ts` :

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 1025),
      secure: false,
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const resetUrl = `${this.config.get('WEB_BASE_URL')}/reset-password?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM'),
        to: email,
        subject: 'Réinitialisation de votre mot de passe ScoreChallenge',
        text: `Pour réinitialiser votre mot de passe, ouvrez ce lien (valable 1 heure) : ${resetUrl}`,
      });
    } catch (error) {
      this.logger.error(`Échec d'envoi de l'email de réinitialisation à ${email}`, error);
    }
  }
}
```

`api/src/mail/mail.module.ts` :

```typescript
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

DTOs :

```typescript
// api/src/auth/dto/forgot-password.dto.ts
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
```

```typescript
// api/src/auth/dto/reset-password.dto.ts
import { IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  token: string;

  @MinLength(8)
  @MaxLength(72)
  password: string;
}
```

Ajouts dans `AuthService` (imports : `BadRequestException`, `randomBytes` de `crypto`, `MailService` injecté) :

```typescript
private static readonly RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 h

async forgotPassword(email: string): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user) {
    return; // pas d'énumération de comptes
  }
  const token = randomBytes(32).toString('hex');
  await this.prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + AuthService.RESET_TOKEN_TTL_MS),
    },
  });
  await this.mailService.sendPasswordReset(email, token);
}

async resetPassword(token: string, password: string): Promise<void> {
  const stored = await this.prisma.passwordResetToken.findUnique({ where: { token } });
  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw new BadRequestException('Lien invalide ou expiré');
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await this.prisma.$transaction([
    this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
    this.prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
```

Ajouts dans `AuthController` :

```typescript
@Public()
@Post('forgot-password')
@HttpCode(204)
async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
  await this.authService.forgotPassword(dto.email);
}

@Public()
@Post('reset-password')
@HttpCode(204)
async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
  await this.authService.resetPassword(dto.token, dto.password);
}
```

Ajouter `MailModule` aux imports de `AppModule`.

- [ ] **Step 5: Vérifier le succès**

Run (dans `api/`): `npm run test:e2e -- password-reset`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add api
git commit -m "feat: add password reset flow with Mailhog email delivery"
```

---

### Task 7: Groupes — création, liste, détail, modification

**Files:**
- Create: `api/src/groups/groups.module.ts`, `groups.service.ts`, `groups.controller.ts`
- Create: `api/src/groups/dto/create-group.dto.ts`, `dto/update-group.dto.ts`
- Create: `api/src/groups/guards/group-owner.guard.ts`
- Create: `api/src/participants/participants.service.ts` (création avec code unique)
- Test: `api/test/groups.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/groups.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb } from './test-utils';

export async function registerOwner(
  app: INestApplication,
  email = 'owner@test.io',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'password123', name: 'Owner' })
    .expect(201);
  return res.body.token;
}

describe('Groups (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    token = await registerOwner(app);
  });

  afterAll(() => app.close());

  it('creates a group with invite token and owner as participant', async () => {
    const res = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CdM 2026', description: 'Open space' })
      .expect(201);
    expect(res.body.inviteToken).toHaveLength(12);
    expect(res.body.scoringExactScore).toBe(5);
    expect(res.body.participants).toHaveLength(1);
    expect(res.body.participants[0].name).toBe('Owner');
    expect(res.body.participants[0].code).toHaveLength(6);
  });

  it('lists my groups only', async () => {
    await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Groupe A' })
      .expect(201);
    const otherToken = await registerOwner(app, 'other@test.io');
    await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Groupe B' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Groupe A');
  });

  it('updates name, description and scoring config', async () => {
    const created = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .patch(`/groups/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoringExactScore: 10 })
      .expect(200);
    expect(res.body.scoringExactScore).toBe(10);
  });

  it('forbids access to a group I do not own', async () => {
    const created = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    const otherToken = await registerOwner(app, 'other@test.io');
    await request(app.getHttpServer())
      .patch(`/groups/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Pirate' })
      .expect(403);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/groups').expect(401);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `npm run test:e2e -- groups`
Expected: FAIL — 404 sur `/groups`.

- [ ] **Step 3: Implémenter**

`api/src/participants/participants.service.ts` (première version — création avec code unique, retentée en cas de collision) :

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { generateParticipantCode } from '../common/codes.util';

const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class ParticipantsService {
  async createWithUniqueCode(
    tx: Prisma.TransactionClient,
    data: { groupId: string; name: string; userId?: string },
  ) {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        return await tx.participant.create({
          data: { ...data, code: generateParticipantCode() },
        });
      } catch (error) {
        const isCodeCollision =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isCodeCollision || attempt === MAX_CODE_ATTEMPTS - 1) {
          throw error;
        }
      }
    }
    throw new Error('unreachable');
  }
}
```

`api/src/groups/dto/create-group.dto.ts` :

```typescript
import { IsInt, IsNotEmpty, IsOptional, Max, MaxLength, Min } from 'class-validator';

export class CreateGroupDto {
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  scoringExactScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  scoringCorrectOutcome?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  scoringOneTeamScore?: number;
}
```

`api/src/groups/dto/update-group.dto.ts` :

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateGroupDto } from './create-group.dto';

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}
```

Run (dans `api/`): `npm install @nestjs/mapped-types`

`api/src/groups/guards/group-owner.guard.ts` :

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GroupOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (user?.role !== 'owner') {
      throw new ForbiddenException('Action réservée au créateur du groupe');
    }
    const groupId: string = request.params.id ?? request.params.groupId;
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Groupe introuvable');
    }
    if (group.ownerId !== user.sub) {
      throw new ForbiddenException('Action réservée au créateur du groupe');
    }
    return true;
  }
}
```

`api/src/groups/groups.service.ts` :

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { Group } from '@prisma/client';
import { generateInviteToken } from '../common/codes.util';
import { ParticipantsService } from '../participants/participants.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly participantsService: ParticipantsService,
  ) {}

  async create(ownerId: string, dto: CreateGroupDto) {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUniqueOrThrow({ where: { id: ownerId } });
      const group = await tx.group.create({
        data: { ...dto, ownerId, inviteToken: generateInviteToken() },
      });
      await this.participantsService.createWithUniqueCode(tx, {
        groupId: group.id,
        name: owner.name,
        userId: ownerId,
      });
      return tx.group.findUniqueOrThrow({
        where: { id: group.id },
        include: { participants: true },
      });
    });
  }

  findMine(ownerId: string): Promise<Group[]> {
    return this.prisma.group.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { participants: { orderBy: { createdAt: 'asc' } } },
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable');
    }
    return group;
  }

  update(groupId: string, dto: UpdateGroupDto) {
    return this.prisma.group.update({ where: { id: groupId }, data: dto });
  }
}
```

`api/src/groups/groups.controller.ts` :

```typescript
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupOwnerGuard } from './guards/group-owner.guard';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(req.user.sub, dto);
  }

  @Get()
  findMine(@Req() req) {
    return this.groupsService.findMine(req.user.sub);
  }

  @UseGuards(GroupOwnerGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupsService.findOne(id);
  }

  @UseGuards(GroupOwnerGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }
}
```

`api/src/groups/groups.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { ParticipantsService } from '../participants/participants.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  controllers: [GroupsController],
  providers: [GroupsService, ParticipantsService],
  exports: [GroupsService],
})
export class GroupsModule {}
```

Ajouter `GroupsModule` aux imports de `AppModule`. (Note : `POST /groups` exige `role === 'owner'` implicitement — un JWT participant a `sub = participantId` qui ne correspond à aucun `User`; ajouter en début de `create()` du controller un rejet explicite si `req.user.role !== 'owner'` via `ForbiddenException`.)

- [ ] **Step 4: Vérifier le succès**

Run (dans `api/`): `npm run test:e2e -- groups`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat: add group creation, listing and management with owner guard"
```

---

### Task 8: Participants — ajout, suppression, limite 50

**Files:**
- Create: `api/src/participants/participants.controller.ts`, `participants.module.ts`
- Create: `api/src/participants/dto/create-participant.dto.ts`
- Modify: `api/src/participants/participants.service.ts`
- Test: `api/test/participants.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/participants.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Participants (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let groupId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    token = await registerOwner(app);
    const res = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    groupId = res.body.id;
  });

  afterAll(() => app.close());

  it('adds a participant with a generated 6-char code', async () => {
    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Marc' })
      .expect(201);
    expect(res.body.name).toBe('Marc');
    expect(res.body.code).toHaveLength(6);
  });

  it('removes a participant', async () => {
    const created = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Marc' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/groups/${groupId}/participants/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('rejects participant #51 with 409', async () => {
    const prisma = app.get(PrismaService);
    // Le groupe a déjà 1 participant (l'owner) : on en insère 49 de plus.
    await prisma.participant.createMany({
      data: Array.from({ length: 49 }, (_, i) => ({
        groupId,
        name: `Joueur ${i}`,
        code: `TEST${String(i).padStart(2, '0')}`,
      })),
    });
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Un de trop' })
      .expect(409);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `npm run test:e2e -- participants`
Expected: FAIL — 404 sur `POST /groups/:id/participants`.

- [ ] **Step 3: Implémenter**

`api/src/participants/dto/create-participant.dto.ts` :

```typescript
import { IsNotEmpty, MaxLength } from 'class-validator';

export class CreateParticipantDto {
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
```

Ajouts dans `ParticipantsService` (injecter `PrismaService` dans le constructeur) :

```typescript
export const MAX_PARTICIPANTS_PER_GROUP = 50;

async addToGroup(groupId: string, dto: CreateParticipantDto) {
  return this.prisma.$transaction(async (tx) => {
    const count = await tx.participant.count({ where: { groupId } });
    if (count >= MAX_PARTICIPANTS_PER_GROUP) {
      throw new ConflictException(
        `Limite de ${MAX_PARTICIPANTS_PER_GROUP} participants atteinte pour ce groupe`,
      );
    }
    return this.createWithUniqueCode(tx, { groupId, name: dto.name });
  });
}

async remove(groupId: string, participantId: string): Promise<void> {
  const participant = await this.prisma.participant.findUnique({
    where: { id: participantId },
  });
  if (!participant || participant.groupId !== groupId) {
    throw new NotFoundException('Participant introuvable');
  }
  await this.prisma.participant.delete({ where: { id: participantId } });
}
```

`api/src/participants/participants.controller.ts` :

```typescript
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GroupOwnerGuard } from '../groups/guards/group-owner.guard';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { ParticipantsService } from './participants.service';

@UseGuards(GroupOwnerGuard)
@Controller('groups/:groupId/participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  add(@Param('groupId') groupId: string, @Body() dto: CreateParticipantDto) {
    return this.participantsService.addToGroup(groupId, dto);
  }

  @Delete(':pid')
  @HttpCode(204)
  remove(@Param('groupId') groupId: string, @Param('pid') pid: string): Promise<void> {
    return this.participantsService.remove(groupId, pid);
  }
}
```

`api/src/participants/participants.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';

@Module({
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
```

Ajouter `ParticipantsModule` aux imports de `AppModule`. Mettre à jour `GroupsModule` pour importer `ParticipantsModule` au lieu de re-fournir `ParticipantsService`.

- [ ] **Step 4: Vérifier le succès**

Run (dans `api/`): `npm run test:e2e -- participants`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat: add participant management with 50-member group limit"
```

---

### Task 9: Parcours invité — page invitation + échange code → JWT

**Files:**
- Modify: `api/src/groups/groups.controller.ts`, `groups.service.ts`
- Create: `api/src/groups/dto/join-group.dto.ts`
- Test: `api/test/join.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/join.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Join flow (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let inviteToken: string;
  let participantCode: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    ownerToken = await registerOwner(app);
    const group = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    inviteToken = group.body.inviteToken;
    const participant = await request(app.getHttpServer())
      .post(`/groups/${group.body.id}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    participantCode = participant.body.code;
  });

  afterAll(() => app.close());

  it('exposes public group info by invite token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/invite/${inviteToken}`)
      .expect(200);
    expect(res.body.name).toBe('CdM 2026');
    expect(res.body.participants).toBeUndefined();
    expect(res.body.inviteToken).toBeUndefined();
  });

  it('exchanges invite token + code for a participant JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken, code: participantCode })
      .expect(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.participant.name).toBe('Marc');
    expect(res.body.groupId).toBeDefined();
  });

  it('accepts lowercase code input', async () => {
    await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken, code: participantCode.toLowerCase() })
      .expect(201);
  });

  it('rejects wrong code with 401', async () => {
    await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken, code: 'XXXXXX' })
      .expect(401);
  });

  it('rejects unknown invite token with 404', async () => {
    await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken: 'doesnotexist', code: participantCode })
      .expect(404);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `npm run test:e2e -- join`
Expected: FAIL — 404 sur `/groups/invite/...`.

- [ ] **Step 3: Implémenter**

`api/src/groups/dto/join-group.dto.ts` :

```typescript
import { IsNotEmpty } from 'class-validator';

export class JoinGroupDto {
  @IsNotEmpty()
  inviteToken: string;

  @IsNotEmpty()
  code: string;
}
```

Ajouts dans `GroupsService` (injecter `JwtService` ; imports `UnauthorizedException`, `ParticipantJwtPayload`) :

```typescript
private static readonly PARTICIPANT_TOKEN_TTL = '90d';

async getPublicInfoByInviteToken(inviteToken: string) {
  const group = await this.prisma.group.findUnique({
    where: { inviteToken },
    select: { name: true, description: true },
  });
  if (!group) {
    throw new NotFoundException('Invitation introuvable');
  }
  return group;
}

async join(dto: JoinGroupDto) {
  const group = await this.prisma.group.findUnique({ where: { inviteToken: dto.inviteToken } });
  if (!group) {
    throw new NotFoundException('Invitation introuvable');
  }
  const participant = await this.prisma.participant.findUnique({
    where: { groupId_code: { groupId: group.id, code: dto.code.toUpperCase() } },
  });
  if (!participant) {
    throw new UnauthorizedException('Code invalide');
  }
  const payload: ParticipantJwtPayload = {
    sub: participant.id,
    groupId: group.id,
    role: 'participant',
  };
  return {
    token: this.jwtService.sign(payload, { expiresIn: GroupsService.PARTICIPANT_TOKEN_TTL }),
    groupId: group.id,
    participant: { id: participant.id, name: participant.name },
  };
}
```

Ajouts dans `GroupsController` (avant les routes `:id` pour éviter les collisions de routes) :

```typescript
@Public()
@Get('invite/:token')
getInviteInfo(@Param('token') token: string) {
  return this.groupsService.getPublicInfoByInviteToken(token);
}

@Public()
@Post('join')
join(@Body() dto: JoinGroupDto) {
  return this.groupsService.join(dto);
}
```

- [ ] **Step 4: Vérifier le succès**

Run (dans `api/`): `npm run test:e2e -- join`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat: add guest join flow exchanging invite token and code for JWT"
```

---

### Task 10: Matchs — création, modification, statut dérivé

**Files:**
- Create: `api/src/matches/matches.module.ts`, `matches.service.ts`, `matches.controller.ts`
- Create: `api/src/matches/dto/create-match.dto.ts`, `dto/update-match.dto.ts`
- Create: `api/src/matches/match-status.util.ts`
- Test: `api/src/matches/match-status.util.spec.ts`, `api/test/matches.e2e-spec.ts`

- [ ] **Step 1: Test unitaire du statut dérivé (échec)**

`api/src/matches/match-status.util.spec.ts` :

```typescript
import { getMatchStatus } from './match-status.util';

describe('getMatchStatus', () => {
  const now = new Date('2026-06-15T15:00:00Z');

  it('returns UPCOMING before kickoff', () => {
    expect(
      getMatchStatus({ kickoffAt: new Date('2026-06-15T16:00:00Z'), finalScoreA: null }, now),
    ).toBe('UPCOMING');
  });

  it('returns LIVE after kickoff without final score', () => {
    expect(
      getMatchStatus({ kickoffAt: new Date('2026-06-15T14:00:00Z'), finalScoreA: null }, now),
    ).toBe('LIVE');
  });

  it('returns FINISHED when final score is set', () => {
    expect(
      getMatchStatus({ kickoffAt: new Date('2026-06-15T14:00:00Z'), finalScoreA: 2 }, now),
    ).toBe('FINISHED');
  });
});
```

- [ ] **Step 2: Run, expect FAIL, puis implémenter**

Run (dans `api/`): `npm test -- match-status` → FAIL.

`api/src/matches/match-status.util.ts` :

```typescript
export type MatchStatus = 'UPCOMING' | 'LIVE' | 'FINISHED';

export function getMatchStatus(
  match: { kickoffAt: Date; finalScoreA: number | null },
  now: Date = new Date(),
): MatchStatus {
  if (match.finalScoreA !== null) {
    return 'FINISHED';
  }
  return now < match.kickoffAt ? 'UPCOMING' : 'LIVE';
}
```

Run: `npm test -- match-status` → PASS (3 tests).

- [ ] **Step 3: Test e2e CRUD matchs (échec)**

`api/test/matches.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

export const FUTURE_KICKOFF = '2030-06-15T16:00:00.000Z';
export const FUTURE_DEADLINE = '2030-06-15T15:00:00.000Z';

describe('Matches (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let groupId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    token = await registerOwner(app);
    const res = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    groupId = res.body.id;
  });

  afterAll(() => app.close());

  it('creates a match with UPCOMING status', async () => {
    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: FUTURE_KICKOFF,
        predictionDeadline: FUTURE_DEADLINE,
      })
      .expect(201);
    expect(res.body.status).toBe('UPCOMING');
  });

  it('rejects deadline after kickoff with 400', async () => {
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: FUTURE_DEADLINE,
        predictionDeadline: FUTURE_KICKOFF,
      })
      .expect(400);
  });

  it('updates a match', async () => {
    const created = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: FUTURE_KICKOFF,
        predictionDeadline: FUTURE_DEADLINE,
      })
      .expect(201);
    const res = await request(app.getHttpServer())
      .patch(`/groups/${groupId}/matches/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamB: 'Argentine' })
      .expect(200);
    expect(res.body.teamB).toBe('Argentine');
  });
});
```

- [ ] **Step 4: Run, expect FAIL, puis implémenter**

Run (dans `api/`): `npm run test:e2e -- matches` → FAIL (404).

`api/src/matches/dto/create-match.dto.ts` :

```typescript
import { IsDateString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMatchDto {
  @IsNotEmpty()
  @MaxLength(50)
  teamA: string;

  @IsNotEmpty()
  @MaxLength(50)
  teamB: string;

  @IsDateString()
  kickoffAt: string;

  @IsDateString()
  predictionDeadline: string;
}
```

`api/src/matches/dto/update-match.dto.ts` :

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateMatchDto } from './create-match.dto';

export class UpdateMatchDto extends PartialType(CreateMatchDto) {}
```

`api/src/matches/matches.service.ts` (première version) :

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Match } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { getMatchStatus, MatchStatus } from './match-status.util';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(groupId: string, dto: CreateMatchDto) {
    this.assertDeadlineBeforeKickoff(dto.predictionDeadline, dto.kickoffAt);
    const match = await this.prisma.match.create({
      data: {
        groupId,
        teamA: dto.teamA,
        teamB: dto.teamB,
        kickoffAt: new Date(dto.kickoffAt),
        predictionDeadline: new Date(dto.predictionDeadline),
      },
    });
    return this.withStatus(match);
  }

  async update(groupId: string, matchId: string, dto: UpdateMatchDto) {
    const match = await this.findInGroup(groupId, matchId);
    const kickoffAt = dto.kickoffAt ?? match.kickoffAt.toISOString();
    const predictionDeadline = dto.predictionDeadline ?? match.predictionDeadline.toISOString();
    this.assertDeadlineBeforeKickoff(predictionDeadline, kickoffAt);
    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        teamA: dto.teamA,
        teamB: dto.teamB,
        kickoffAt: new Date(kickoffAt),
        predictionDeadline: new Date(predictionDeadline),
      },
    });
    return this.withStatus(updated);
  }

  async findInGroup(groupId: string, matchId: string): Promise<Match> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match || match.groupId !== groupId) {
      throw new NotFoundException('Match introuvable');
    }
    return match;
  }

  private assertDeadlineBeforeKickoff(deadline: string, kickoff: string): void {
    if (new Date(deadline) > new Date(kickoff)) {
      throw new BadRequestException(
        'La date limite de pronostic doit précéder le coup d’envoi',
      );
    }
  }

  private withStatus(match: Match): Match & { status: MatchStatus } {
    return { ...match, status: getMatchStatus(match) };
  }
}
```

`api/src/matches/matches.controller.ts` (première version) :

```typescript
import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GroupOwnerGuard } from '../groups/guards/group-owner.guard';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchesService } from './matches.service';

@Controller('groups/:groupId/matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @UseGuards(GroupOwnerGuard)
  @Post()
  create(@Param('groupId') groupId: string, @Body() dto: CreateMatchDto) {
    return this.matchesService.create(groupId, dto);
  }

  @UseGuards(GroupOwnerGuard)
  @Patch(':mid')
  update(
    @Param('groupId') groupId: string,
    @Param('mid') matchId: string,
    @Body() dto: UpdateMatchDto,
  ) {
    return this.matchesService.update(groupId, matchId, dto);
  }
}
```

`api/src/matches/matches.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
```

Ajouter `MatchesModule` aux imports de `AppModule`.

Run: `npm run test:e2e -- matches` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat: add match CRUD with derived status and deadline validation"
```

---

### Task 11: ScoringService (TDD pur)

**Files:**
- Create: `api/src/predictions/scoring.service.ts`
- Test: `api/src/predictions/scoring.service.spec.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

`api/src/predictions/scoring.service.spec.ts` :

```typescript
import { ScoringService } from './scoring.service';

describe('ScoringService', () => {
  const service = new ScoringService();
  const config = { exactScore: 5, correctOutcome: 3, oneTeamScore: 1 };

  it.each([
    // [predA, predB, resA, resB, expected, label]
    [3, 2, 3, 2, 5, 'score exact'],
    [0, 0, 0, 0, 5, 'score exact 0-0'],
    [2, 1, 4, 0, 3, 'bon vainqueur (équipe A)'],
    [0, 2, 1, 3, 3, 'bon vainqueur (équipe B)'],
    [1, 1, 2, 2, 3, 'bon match nul'],
    [3, 1, 3, 0, 3, 'bon vainqueur prime sur bon score d’une équipe'],
    [0, 2, 3, 2, 1, 'bon score équipe B seulement'],
    [1, 0, 0, 2, 0, 'tout faux'],
  ])('pred %i-%i vs result %i-%i → %i points (%s)', (pa, pb, ra, rb, expected) => {
    expect(service.computePoints({ a: pa, b: pb }, { a: ra, b: rb }, config)).toBe(expected);
  });

  it('uses configurable point values', () => {
    const custom = { exactScore: 10, correctOutcome: 5, oneTeamScore: 2 };
    expect(service.computePoints({ a: 1, b: 0 }, { a: 1, b: 0 }, custom)).toBe(10);
    expect(service.computePoints({ a: 2, b: 0 }, { a: 1, b: 0 }, custom)).toBe(5);
    expect(service.computePoints({ a: 1, b: 2 }, { a: 1, b: 0 }, custom)).toBe(2);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `npm test -- scoring`
Expected: FAIL — `Cannot find module './scoring.service'`.

- [ ] **Step 3: Implémenter**

`api/src/predictions/scoring.service.ts` :

```typescript
import { Injectable } from '@nestjs/common';

export interface Score {
  a: number;
  b: number;
}

export interface ScoringConfig {
  exactScore: number;
  correctOutcome: number;
  oneTeamScore: number;
}

@Injectable()
export class ScoringService {
  computePoints(prediction: Score, result: Score, config: ScoringConfig): number {
    if (prediction.a === result.a && prediction.b === result.b) {
      return config.exactScore;
    }
    if (Math.sign(prediction.a - prediction.b) === Math.sign(result.a - result.b)) {
      return config.correctOutcome;
    }
    if (prediction.a === result.a || prediction.b === result.b) {
      return config.oneTeamScore;
    }
    return 0;
  }
}
```

- [ ] **Step 4: Vérifier le succès**

Run (dans `api/`): `npm test -- scoring`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add api/src/predictions
git commit -m "feat: add pure scoring service with configurable point values"
```

---

### Task 12: Saisie du résultat final + calcul des points

**Files:**
- Modify: `api/src/matches/matches.service.ts`, `matches.controller.ts`, `matches.module.ts`
- Create: `api/src/matches/dto/set-result.dto.ts`
- Test: `api/test/results.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/results.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { FUTURE_DEADLINE, FUTURE_KICKOFF } from './matches.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Match results (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let groupId: string;
  let matchId: string;
  let participantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    token = await registerOwner(app);
    const group = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    groupId = group.body.id;
    const match = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: FUTURE_KICKOFF,
        predictionDeadline: FUTURE_DEADLINE,
      })
      .expect(201);
    matchId = match.body.id;
    const participant = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Marc' })
      .expect(201);
    participantId = participant.body.id;
    // Pronostic inséré directement (l'endpoint PUT prediction arrive en Task 13)
    await prisma.prediction.create({
      data: { matchId, participantId, scoreA: 3, scoreB: 2 },
    });
  });

  afterAll(() => app.close());

  it('stores result and computes points for all predictions', async () => {
    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 3, scoreB: 2 })
      .expect(201);
    expect(res.body.status).toBe('FINISHED');

    const prediction = await prisma.prediction.findFirstOrThrow({ where: { participantId } });
    expect(prediction.points).toBe(5); // score exact
  });

  it('recomputes points when result is corrected', async () => {
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 3, scoreB: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 0, scoreB: 2 })
      .expect(201);

    const prediction = await prisma.prediction.findFirstOrThrow({ where: { participantId } });
    expect(prediction.points).toBe(1); // seul le score de l'équipe B (2) est bon
  });

  it('forbids non-owner from setting result', async () => {
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/${matchId}/result`)
      .send({ scoreA: 1, scoreB: 0 })
      .expect(401);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `npm run test:e2e -- results`
Expected: FAIL — 404 sur `POST .../result`.

- [ ] **Step 3: Implémenter**

`api/src/matches/dto/set-result.dto.ts` :

```typescript
import { IsInt, Max, Min } from 'class-validator';

export class SetResultDto {
  @IsInt()
  @Min(0)
  @Max(99)
  scoreA: number;

  @IsInt()
  @Min(0)
  @Max(99)
  scoreB: number;
}
```

Ajout dans `MatchesService` (injecter `ScoringService`) :

```typescript
async setResult(groupId: string, matchId: string, dto: SetResultDto) {
  await this.findInGroup(groupId, matchId);
  const group = await this.prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  const config = {
    exactScore: group.scoringExactScore,
    correctOutcome: group.scoringCorrectOutcome,
    oneTeamScore: group.scoringOneTeamScore,
  };

  const updated = await this.prisma.$transaction(async (tx) => {
    const match = await tx.match.update({
      where: { id: matchId },
      data: { finalScoreA: dto.scoreA, finalScoreB: dto.scoreB },
    });
    const predictions = await tx.prediction.findMany({ where: { matchId } });
    for (const prediction of predictions) {
      const points = this.scoringService.computePoints(
        { a: prediction.scoreA, b: prediction.scoreB },
        { a: dto.scoreA, b: dto.scoreB },
        config,
      );
      await tx.prediction.update({ where: { id: prediction.id }, data: { points } });
    }
    return match;
  });
  return this.withStatus(updated);
}
```

Ajout dans `MatchesController` :

```typescript
@UseGuards(GroupOwnerGuard)
@Post(':mid/result')
setResult(
  @Param('groupId') groupId: string,
  @Param('mid') matchId: string,
  @Body() dto: SetResultDto,
) {
  return this.matchesService.setResult(groupId, matchId, dto);
}
```

Ajouter `ScoringService` aux providers de `MatchesModule` (et l'exporter depuis un futur `PredictionsModule` en Task 13 — pour l'instant, provider direct).

- [ ] **Step 4: Vérifier le succès**

Run (dans `api/`): `npm run test:e2e -- results`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat: add final result entry with automatic points computation"
```

---

### Task 13: Pronostics — soumission, modification unique, verrouillage

**Files:**
- Create: `api/src/predictions/predictions.module.ts`, `predictions.service.ts`, `predictions.controller.ts`
- Create: `api/src/predictions/dto/upsert-prediction.dto.ts`
- Modify: `api/src/matches/matches.module.ts` (importer PredictionsModule pour ScoringService)
- Test: `api/test/predictions.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/predictions.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { FUTURE_DEADLINE, FUTURE_KICKOFF } from './matches.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Predictions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let participantToken: string;
  let groupId: string;
  let matchId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    ownerToken = await registerOwner(app);
    const group = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    groupId = group.body.id;
    const match = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: FUTURE_KICKOFF,
        predictionDeadline: FUTURE_DEADLINE,
      })
      .expect(201);
    matchId = match.body.id;
    const participant = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    const joined = await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken: group.body.inviteToken, code: participant.body.code })
      .expect(201);
    participantToken = joined.body.token;
  });

  afterAll(() => app.close());

  function submit(token: string, scores: { scoreA: number; scoreB: number }) {
    return request(app.getHttpServer())
      .put(`/matches/${matchId}/prediction`)
      .set('Authorization', `Bearer ${token}`)
      .send(scores);
  }

  it('submits an initial prediction (editCount 0)', async () => {
    const res = await submit(participantToken, { scoreA: 2, scoreB: 1 }).expect(200);
    expect(res.body.scoreA).toBe(2);
    expect(res.body.editCount).toBe(0);
  });

  it('allows exactly one modification then locks', async () => {
    await submit(participantToken, { scoreA: 2, scoreB: 1 }).expect(200);
    const second = await submit(participantToken, { scoreA: 3, scoreB: 0 }).expect(200);
    expect(second.body.editCount).toBe(1);
    expect(second.body.lockedAt).toBeDefined();
    await submit(participantToken, { scoreA: 1, scoreB: 1 }).expect(403);
  });

  it('rejects prediction after deadline', async () => {
    await prisma.match.update({
      where: { id: matchId },
      data: { predictionDeadline: new Date(Date.now() - 60_000) },
    });
    await submit(participantToken, { scoreA: 2, scoreB: 1 }).expect(403);
  });

  it('rejects prediction once final score is set', async () => {
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scoreA: 1, scoreB: 0 })
      .expect(201);
    await submit(participantToken, { scoreA: 2, scoreB: 1 }).expect(403);
  });

  it('lets the owner predict as a participant too', async () => {
    const res = await submit(ownerToken, { scoreA: 1, scoreB: 1 }).expect(200);
    expect(res.body.scoreA).toBe(1);
  });

  it('rejects participant from another group', async () => {
    const otherOwner = await registerOwner(app, 'other@test.io');
    const otherGroup = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${otherOwner}`)
      .send({ name: 'Autre groupe' })
      .expect(201);
    const stranger = await request(app.getHttpServer())
      .post(`/groups/${otherGroup.body.id}/participants`)
      .set('Authorization', `Bearer ${otherOwner}`)
      .send({ name: 'Intrus' })
      .expect(201);
    const joined = await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken: otherGroup.body.inviteToken, code: stranger.body.code })
      .expect(201);
    await submit(joined.body.token, { scoreA: 2, scoreB: 1 }).expect(403);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `npm run test:e2e -- predictions`
Expected: FAIL — 404 sur `PUT /matches/:mid/prediction`.

- [ ] **Step 3: Implémenter**

`api/src/predictions/dto/upsert-prediction.dto.ts` :

```typescript
import { IsInt, Max, Min } from 'class-validator';

export class UpsertPredictionDto {
  @IsInt()
  @Min(0)
  @Max(99)
  scoreA: number;

  @IsInt()
  @Min(0)
  @Max(99)
  scoreB: number;
}
```

`api/src/predictions/predictions.service.ts` :

```typescript
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Participant, Prediction } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPredictionDto } from './dto/upsert-prediction.dto';

@Injectable()
export class PredictionsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertForMatch(
    user: JwtPayload,
    matchId: string,
    dto: UpsertPredictionDto,
  ): Promise<Prediction> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException('Match introuvable');
    }
    if (match.finalScoreA !== null) {
      throw new ForbiddenException('Le résultat final est déjà enregistré');
    }
    if (new Date() > match.predictionDeadline) {
      throw new ForbiddenException('La date limite de pronostic est dépassée');
    }

    const participant = await this.resolveParticipant(user, match.groupId);

    const existing = await this.prisma.prediction.findUnique({
      where: { matchId_participantId: { matchId, participantId: participant.id } },
    });
    if (!existing) {
      return this.prisma.prediction.create({
        data: { matchId, participantId: participant.id, scoreA: dto.scoreA, scoreB: dto.scoreB },
      });
    }
    if (existing.editCount >= 1) {
      throw new ForbiddenException('Pronostic verrouillé : une seule modification autorisée');
    }
    return this.prisma.prediction.update({
      where: { id: existing.id },
      data: { scoreA: dto.scoreA, scoreB: dto.scoreB, editCount: 1, lockedAt: new Date() },
    });
  }

  async resolveParticipant(user: JwtPayload, groupId: string): Promise<Participant> {
    if (user.role === 'participant') {
      if (user.groupId !== groupId) {
        throw new ForbiddenException('Ce match n’appartient pas à votre groupe');
      }
      const participant = await this.prisma.participant.findUnique({ where: { id: user.sub } });
      if (!participant) {
        throw new ForbiddenException('Participant introuvable');
      }
      return participant;
    }
    const participant = await this.prisma.participant.findFirst({
      where: { groupId, userId: user.sub },
    });
    if (!participant) {
      throw new ForbiddenException('Vous n’êtes pas participant de ce groupe');
    }
    return participant;
  }
}
```

`api/src/predictions/predictions.controller.ts` :

```typescript
import { Body, Controller, Param, Put, Req } from '@nestjs/common';
import { Prediction } from '@prisma/client';
import { UpsertPredictionDto } from './dto/upsert-prediction.dto';
import { PredictionsService } from './predictions.service';

@Controller('matches/:mid/prediction')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Put()
  upsert(
    @Req() req,
    @Param('mid') matchId: string,
    @Body() dto: UpsertPredictionDto,
  ): Promise<Prediction> {
    return this.predictionsService.upsertForMatch(req.user, matchId, dto);
  }
}
```

`api/src/predictions/predictions.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { ScoringService } from './scoring.service';

@Module({
  controllers: [PredictionsController],
  providers: [PredictionsService, ScoringService],
  exports: [PredictionsService, ScoringService],
})
export class PredictionsModule {}
```

Ajouter `PredictionsModule` aux imports de `AppModule` et de `MatchesModule` (retirer le provider direct `ScoringService` de `MatchesModule`).

- [ ] **Step 4: Vérifier le succès**

Run (dans `api/`): `npm run test:e2e -- predictions`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat: add prediction submission with single-edit lock and deadline rules"
```

---

### Task 14: Liste des matchs avec visibilité des pronostics

**Files:**
- Modify: `api/src/matches/matches.service.ts`, `matches.controller.ts`
- Create: `api/src/groups/guards/group-member.guard.ts`
- Test: `api/test/match-list.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/match-list.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { FUTURE_DEADLINE, FUTURE_KICKOFF } from './matches.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Match list with prediction visibility (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let participantToken: string;
  let groupId: string;
  let matchId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    ownerToken = await registerOwner(app);
    const group = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    groupId = group.body.id;
    const match = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: FUTURE_KICKOFF,
        predictionDeadline: FUTURE_DEADLINE,
      })
      .expect(201);
    matchId = match.body.id;
    const participant = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    const joined = await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken: group.body.inviteToken, code: participant.body.code })
      .expect(201);
    participantToken = joined.body.token;

    // Pronostics : owner 1-1, Marc 2-1
    await request(app.getHttpServer())
      .put(`/matches/${matchId}/prediction`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scoreA: 1, scoreB: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/matches/${matchId}/prediction`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ scoreA: 2, scoreB: 1 })
      .expect(200);
  });

  afterAll(() => app.close());

  it('hides other predictions before deadline, shows mine', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(200);
    const match = res.body[0];
    expect(match.myPrediction.scoreA).toBe(2);
    expect(match.predictions).toEqual([]);
  });

  it('reveals all predictions after deadline', async () => {
    await prisma.match.update({
      where: { id: matchId },
      data: { predictionDeadline: new Date(Date.now() - 60_000) },
    });
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(200);
    expect(res.body[0].predictions).toHaveLength(2);
    expect(res.body[0].predictions[0].participant.name).toBeDefined();
  });

  it('rejects a participant JWT from another group', async () => {
    const otherOwner = await registerOwner(app, 'other@test.io');
    const otherGroup = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${otherOwner}`)
      .send({ name: 'Autre' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/groups/${otherGroup.body.id}/matches`)
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(403);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `npm run test:e2e -- match-list`
Expected: FAIL — 404 sur `GET /groups/:id/matches`.

- [ ] **Step 3: Implémenter**

`api/src/groups/guards/group-member.guard.ts` :

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GroupMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const groupId: string = request.params.id ?? request.params.groupId;

    if (user.role === 'participant') {
      if (user.groupId !== groupId) {
        throw new ForbiddenException('Accès limité à votre groupe');
      }
      return true;
    }
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException('Groupe introuvable');
    }
    if (group.ownerId !== user.sub) {
      throw new ForbiddenException('Accès limité à vos groupes');
    }
    return true;
  }
}
```

Ajout dans `MatchesService` (injecter `PredictionsService`) :

```typescript
async listForGroup(groupId: string, user: JwtPayload) {
  const me = await this.predictionsService.resolveParticipant(user, groupId);
  const matches = await this.prisma.match.findMany({
    where: { groupId },
    orderBy: { kickoffAt: 'asc' },
    include: {
      predictions: {
        include: { participant: { select: { id: true, name: true } } },
      },
    },
  });
  const now = new Date();
  return matches.map((match) => {
    const revealed = now > match.predictionDeadline;
    const { predictions, ...rest } = match;
    return {
      ...rest,
      status: getMatchStatus(match, now),
      myPrediction: predictions.find((p) => p.participantId === me.id) ?? null,
      predictions: revealed ? predictions : [],
    };
  });
}
```

Ajout dans `MatchesController` :

```typescript
@UseGuards(GroupMemberGuard)
@Get()
list(@Param('groupId') groupId: string, @Req() req) {
  return this.matchesService.listForGroup(groupId, req.user);
}
```

(Imports `Get`, `Req`, `GroupMemberGuard`. `MatchesModule` importe `PredictionsModule`.)

- [ ] **Step 4: Vérifier le succès**

Run (dans `api/`): `npm run test:e2e -- match-list`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat: add match list with prediction visibility rules"
```

---

### Task 15: Statistiques — classement, stats individuelles, stats groupe

**Files:**
- Create: `api/src/stats/stats.module.ts`, `stats.service.ts`, `stats.controller.ts`
- Test: `api/test/stats.e2e-spec.ts`

- [ ] **Step 1: Écrire le test e2e qui échoue**

`api/test/stats.e2e-spec.ts` :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let groupId: string;
  let ownerParticipantId: string;
  let marcId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    ownerToken = await registerOwner(app);
    const group = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    groupId = group.body.id;
    ownerParticipantId = group.body.participants[0].id;
    const marc = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    marcId = marc.body.id;

    // 2 matchs terminés, insérés directement avec points figés :
    // Marc : 5 pts (exact) + 3 pts (vainqueur) = 8 ; Owner : 0 + 1 = 1.
    const past = { kickoffAt: new Date('2026-01-01T15:00:00Z'), predictionDeadline: new Date('2026-01-01T14:00:00Z') };
    const m1 = await prisma.match.create({
      data: { groupId, teamA: 'France', teamB: 'Brésil', ...past, finalScoreA: 3, finalScoreB: 2 },
    });
    const m2 = await prisma.match.create({
      data: { groupId, teamA: 'Maroc', teamB: 'Japon', ...past, finalScoreA: 1, finalScoreB: 0 },
    });
    await prisma.prediction.createMany({
      data: [
        { matchId: m1.id, participantId: marcId, scoreA: 3, scoreB: 2, points: 5 },
        { matchId: m2.id, participantId: marcId, scoreA: 2, scoreB: 0, points: 3 },
        { matchId: m1.id, participantId: ownerParticipantId, scoreA: 0, scoreB: 1, points: 0 },
        { matchId: m2.id, participantId: ownerParticipantId, scoreA: 2, scoreB: 0, points: 3 },
      ],
    });
  });

  afterAll(() => app.close());

  it('returns ranking ordered by total points', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/ranking`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body[0].name).toBe('Marc');
    expect(res.body[0].totalPoints).toBe(8);
    expect(res.body[0].rank).toBe(1);
    expect(res.body[0].exactScores).toBe(1);
    expect(res.body[0].matchesPlayed).toBe(2);
    expect(res.body[0].successRate).toBe(100);
    expect(res.body[1].totalPoints).toBe(3);
  });

  it('returns individual stats', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/participants/${marcId}/stats`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.totalPoints).toBe(8);
    expect(res.body.exactScores).toBe(1);
    expect(res.body.correctOutcomes).toBe(1);
    expect(res.body.averagePoints).toBe(4);
    expect(res.body.rank).toBe(1);
  });

  it('returns group stats', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/stats`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.participantCount).toBe(2);
    expect(res.body.matchCount).toBe(2);
    expect(res.body.bestPlayer.name).toBe('Marc');
    expect(res.body.mostExactScores.name).toBe('Marc');
    expect(res.body.averagePointsPerPlayer).toBe(5.5);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run (dans `api/`): `npm run test:e2e -- stats`
Expected: FAIL — 404 sur `/groups/:id/ranking`.

- [ ] **Step 3: Implémenter**

`api/src/stats/stats.service.ts` :

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface RankingRow {
  id: string;
  name: string;
  totalPoints: number;
  matchesPlayed: number;
  correctPredictions: number;
  exactScores: number;
  correctOutcomes: number;
}

export interface RankingEntry extends RankingRow {
  rank: number;
  successRate: number;
  averagePoints: number;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRanking(groupId: string): Promise<RankingEntry[]> {
    const rows = await this.prisma.$queryRaw<RankingRow[]>`
      SELECT p.id,
             p.name,
             COALESCE(SUM(pr.points), 0)::int                                   AS "totalPoints",
             COUNT(pr.id)::int                                                  AS "matchesPlayed",
             COUNT(pr.id) FILTER (WHERE pr.points > 0)::int                     AS "correctPredictions",
             COUNT(pr.id) FILTER (WHERE pr.points = g."scoringExactScore")::int AS "exactScores",
             COUNT(pr.id) FILTER (WHERE pr.points = g."scoringCorrectOutcome")::int AS "correctOutcomes"
      FROM "Participant" p
      JOIN "Group" g ON g.id = p."groupId"
      LEFT JOIN "Prediction" pr ON pr."participantId" = p.id AND pr.points IS NOT NULL
      WHERE p."groupId" = ${groupId}
      GROUP BY p.id, p.name, g."scoringExactScore", g."scoringCorrectOutcome"
      ORDER BY "totalPoints" DESC, "exactScores" DESC, p.name ASC
    `;
    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      successRate: row.matchesPlayed
        ? Math.round((row.correctPredictions / row.matchesPlayed) * 100)
        : 0,
      averagePoints: row.matchesPlayed
        ? Math.round((row.totalPoints / row.matchesPlayed) * 100) / 100
        : 0,
    }));
  }

  async getParticipantStats(groupId: string, participantId: string): Promise<RankingEntry> {
    const ranking = await this.getRanking(groupId);
    const entry = ranking.find((r) => r.id === participantId);
    if (!entry) {
      throw new NotFoundException('Participant introuvable');
    }
    return entry;
  }

  async getGroupStats(groupId: string) {
    const ranking = await this.getRanking(groupId);
    const matchCount = await this.prisma.match.count({ where: { groupId } });
    const participantCount = ranking.length;
    const totalPoints = ranking.reduce((sum, r) => sum + r.totalPoints, 0);
    const mostExact = [...ranking].sort((a, b) => b.exactScores - a.exactScores)[0] ?? null;
    return {
      participantCount,
      matchCount,
      averagePointsPerPlayer: participantCount
        ? Math.round((totalPoints / participantCount) * 100) / 100
        : 0,
      bestPlayer: ranking[0] ?? null,
      mostExactScores: mostExact,
      ranking,
    };
  }
}
```

`api/src/stats/stats.controller.ts` :

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GroupMemberGuard } from '../groups/guards/group-member.guard';
import { StatsService } from './stats.service';

@UseGuards(GroupMemberGuard)
@Controller('groups/:groupId')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('ranking')
  getRanking(@Param('groupId') groupId: string) {
    return this.statsService.getRanking(groupId);
  }

  @Get('stats')
  getGroupStats(@Param('groupId') groupId: string) {
    return this.statsService.getGroupStats(groupId);
  }

  @Get('participants/:pid/stats')
  getParticipantStats(@Param('groupId') groupId: string, @Param('pid') pid: string) {
    return this.statsService.getParticipantStats(groupId, pid);
  }
}
```

`api/src/stats/stats.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
```

Ajouter `StatsModule` aux imports de `AppModule`.

- [ ] **Step 4: Vérifier le succès**

Run (dans `api/`): `npm run test:e2e -- stats`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat: add ranking, participant and group statistics via SQL aggregation"
```

---

### Task 16: Test e2e du parcours complet + README

**Files:**
- Test: `api/test/full-flow.e2e-spec.ts`
- Create: `README.md`

- [ ] **Step 1: Écrire le test du parcours complet**

`api/test/full-flow.e2e-spec.ts` — scénario de bout en bout (ce test doit passer immédiatement si les tâches précédentes sont correctes ; s'il échoue, déboguer avant de continuer) :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './test-utils';

describe('Full flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDb(app);
  });

  afterAll(() => app.close());

  it('runs the complete scenario: register → group → invite → predict → result → ranking', async () => {
    const server = app.getHttpServer();

    // 1. Aline crée un compte et un groupe
    const auth = await request(server)
      .post('/auth/register')
      .send({ email: 'aline@test.io', password: 'password123', name: 'Aline' })
      .expect(201);
    const ownerToken = auth.body.token;
    const group = await request(server)
      .post('/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CdM 2026 — Open Space' })
      .expect(201);
    const groupId = group.body.id;

    // 2. Elle ajoute Marc et crée un match
    const marc = await request(server)
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    const match = await request(server)
      .post(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: '2030-06-15T16:00:00.000Z',
        predictionDeadline: '2030-06-15T15:00:00.000Z',
      })
      .expect(201);

    // 3. Marc rejoint via le lien + son code, et pronostique 3-2
    const joined = await request(server)
      .post('/groups/join')
      .send({ inviteToken: group.body.inviteToken, code: marc.body.code })
      .expect(201);
    await request(server)
      .put(`/matches/${match.body.id}/prediction`)
      .set('Authorization', `Bearer ${joined.body.token}`)
      .send({ scoreA: 3, scoreB: 2 })
      .expect(200);

    // 4. Aline pronostique 1-1, puis saisit le résultat 3-2
    await request(server)
      .put(`/matches/${match.body.id}/prediction`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scoreA: 1, scoreB: 1 })
      .expect(200);
    await request(server)
      .post(`/groups/${groupId}/matches/${match.body.id}/result`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scoreA: 3, scoreB: 2 })
      .expect(201);

    // 5. Classement : Marc 5 pts (exact), Aline 0
    const ranking = await request(server)
      .get(`/groups/${groupId}/ranking`)
      .set('Authorization', `Bearer ${joined.body.token}`)
      .expect(200);
    expect(ranking.body[0].name).toBe('Marc');
    expect(ranking.body[0].totalPoints).toBe(5);
    expect(ranking.body[1].name).toBe('Aline');
    expect(ranking.body[1].totalPoints).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer toute la suite**

Run (dans `api/`): `npm test && npm run test:e2e`
Expected: PASS sur l'ensemble (unitaires + e2e).

- [ ] **Step 3: Écrire le README racine**

```markdown
# ScoreChallenge

Application de pronostics de matchs entre amis, collègues et communautés.

- **Documentation produit** : [docs/PROJECT.md](docs/PROJECT.md)
- **Design technique** : [docs/superpowers/specs/2026-06-12-scorechallenge-design.md](docs/superpowers/specs/2026-06-12-scorechallenge-design.md)

## Démarrage rapide

```bash
make db-start      # PostgreSQL + Mailhog (Docker)
make install       # dépendances
make db-migrate    # migrations Prisma
make dev-api       # API sur http://localhost:3000
```

## Tests

```bash
make db-test-create   # une seule fois
make test
```

Toutes les commandes : `make help`.
```

- [ ] **Step 4: Commit**

```bash
git add api/test/full-flow.e2e-spec.ts README.md
git commit -m "test: add full end-to-end scenario and project README"
```

---

## Critères de fin du plan

- `make test` entièrement vert (unitaires + e2e).
- Tous les endpoints de la spec implémentés et testés.
- Prochaine étape : rédiger le Plan 2 (frontend Angular + PrimeNG + Tailwind + Signal Store, design premium via skill `frontend-design`) en utilisant les DTO réels de cette API comme contrat.
