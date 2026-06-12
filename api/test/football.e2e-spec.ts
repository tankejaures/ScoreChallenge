import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { FootballApiClient } from '../src/football/football-api.client';
import {
  ApiFixtureEntry,
  CompetitionDto,
} from '../src/football/football-api.types';
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
    await request(app.getHttpServer())
      .get('/football/competitions')
      .expect(401);
  });

  it('lists fixtures and upserts them in DB', async () => {
    footballClientMock.getFixtures.mockResolvedValue([
      fakeApiFixture({ id: 101 }),
    ]);
    const res = await request(app.getHttpServer())
      .get('/football/competitions/1/fixtures?season=2026')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const fixtures = res.body as { externalId: number; teamA: string }[];
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].teamA).toBe('France');

    const prisma = app.get(PrismaService);
    const stored = await prisma.fixture.findUnique({
      where: { externalId: 101 },
    });
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
