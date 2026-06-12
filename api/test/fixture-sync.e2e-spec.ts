import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { FixtureSyncService } from '../src/sports/fixture-sync.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import {
  createTestAppWithSportsMock,
  fakeGame,
  sportsClientMock,
} from './sports.e2e-spec';
import { resetDb } from './test-utils';

describe('FixtureSync (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sync: FixtureSyncService;
  let token: string;
  let groupId: string;
  let fixtureId: string;
  let matchId: string;

  beforeAll(async () => {
    app = await createTestAppWithSportsMock();
    prisma = app.get(PrismaService);
    sync = app.get(FixtureSyncService);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    sportsClientMock.isConfigured.mockReturnValue(true);
    await resetDb(app);
    token = await registerOwner(app);

    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'CdM',
        competition: {
          sport: 'FOOTBALL',
          leagueId: 1,
          season: '2026',
          name: 'World Cup',
        },
      })
      .expect(201);
    groupId = (groupRes.body as { id: string }).id;

    // Fixture dont le coup d'envoi vient de passer (dans la fenêtre de surveillance)
    const fixture = await prisma.fixture.create({
      data: {
        externalId: 777,
        leagueId: 1,
        season: '2026',
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: new Date(Date.now() - 60 * 1000),
        status: 'SCHEDULED',
      },
    });
    fixtureId = fixture.id;

    const importRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    matchId = (importRes.body as { id: string }[])[0].id;
  });

  afterAll(() => app.close());

  it('updates live score from the API', async () => {
    sportsClientMock.getLiveGames.mockResolvedValue([
      fakeGame({ id: 777, status: 'LIVE', minute: 23, scoreA: 1, scoreB: 0 }),
    ]);
    await sync.sync();
    expect(sportsClientMock.getLiveGames).toHaveBeenCalledWith('FOOTBALL', [
      expect.objectContaining({ externalId: 777 }),
    ]);
    const fixture = await prisma.fixture.findUniqueOrThrow({
      where: { id: fixtureId },
    });
    expect(fixture.status).toBe('LIVE');
    expect(fixture.minute).toBe(23);
    expect(fixture.scoreA).toBe(1);
  });

  it('settles linked matches when the fixture finishes', async () => {
    // Deadline = kickoff (déjà passé) → pronostic inséré directement en DB.
    const participant = await prisma.participant.findFirstOrThrow({
      where: { groupId },
    });
    await prisma.prediction.create({
      data: { matchId, participantId: participant.id, scoreA: 2, scoreB: 0 },
    });

    sportsClientMock.getLiveGames.mockResolvedValue([
      fakeGame({ id: 777, status: 'FINISHED', scoreA: 2, scoreB: 0 }),
    ]);
    await sync.sync();

    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
    });
    expect(match.finalScoreA).toBe(2);
    expect(match.finalScoreB).toBe(0);
    const prediction = await prisma.prediction.findFirstOrThrow({
      where: { matchId },
    });
    expect(prediction.points).toBe(5); // score exact, barème par défaut
  });

  it('does nothing when no fixture is in the watch window', async () => {
    await prisma.fixture.update({
      where: { id: fixtureId },
      data: { kickoffAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    await sync.sync();
    expect(sportsClientMock.getLiveGames).not.toHaveBeenCalled();
  });

  it('does nothing when the API key is missing', async () => {
    sportsClientMock.isConfigured.mockReturnValue(false);
    await sync.sync();
    expect(sportsClientMock.getLiveGames).not.toHaveBeenCalled();
  });

  it('survives an API failure and keeps DB data intact', async () => {
    sportsClientMock.getLiveGames.mockRejectedValue(new Error('quota'));
    await expect(sync.sync()).resolves.toBeUndefined();
    const fixture = await prisma.fixture.findUniqueOrThrow({
      where: { id: fixtureId },
    });
    expect(fixture.status).toBe('SCHEDULED');
  });

  it('routes basketball fixtures to the basketball adapter and settles', async () => {
    const basketToken = await registerOwner(app, 'basket@test.io');
    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${basketToken}`)
      .send({
        name: 'NBA Challenge',
        competition: {
          sport: 'BASKETBALL',
          leagueId: 12,
          season: '2025-2026',
          name: 'NBA',
        },
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
      .set('Authorization', `Bearer ${basketToken}`)
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

    expect(sportsClientMock.getLiveGames).toHaveBeenCalledWith(
      'BASKETBALL',
      [expect.objectContaining({ externalId: 901, season: '2025-2026' })],
    );
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
