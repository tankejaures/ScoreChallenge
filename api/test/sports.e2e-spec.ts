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
