import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { FixtureSyncService } from '../src/football/fixture-sync.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestAppWithFootballMock,
  fakeApiFixture,
  footballClientMock,
} from './football.e2e-spec';
import { registerOwner } from './groups.e2e-spec';
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
    app = await createTestAppWithFootballMock();
    prisma = app.get(PrismaService);
    sync = app.get(FixtureSyncService);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    footballClientMock.isConfigured.mockReturnValue(true);
    await resetDb(app);
    token = await registerOwner(app);

    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'CdM',
        competition: { leagueId: 1, season: 2026, name: 'World Cup' },
      })
      .expect(201);
    groupId = (groupRes.body as { id: string }).id;

    // Fixture dont le coup d'envoi vient de passer (dans la fenêtre de surveillance)
    const fixture = await prisma.fixture.create({
      data: {
        externalId: 777,
        leagueId: 1,
        season: 2026,
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

  it('updates live score and minute from the API', async () => {
    footballClientMock.getFixturesByIds.mockResolvedValue([
      fakeApiFixture({ id: 777, status: '1H', elapsed: 23, home: 1, away: 0 }),
    ]);
    await sync.sync();
    expect(footballClientMock.getFixturesByIds).toHaveBeenCalledWith([777]);
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

    footballClientMock.getFixturesByIds.mockResolvedValue([
      fakeApiFixture({ id: 777, status: 'FT', elapsed: 90, home: 2, away: 0 }),
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
    expect(footballClientMock.getFixturesByIds).not.toHaveBeenCalled();
  });

  it('does nothing when the API key is missing', async () => {
    footballClientMock.isConfigured.mockReturnValue(false);
    await sync.sync();
    expect(footballClientMock.getFixturesByIds).not.toHaveBeenCalled();
  });

  it('survives an API failure and keeps DB data intact', async () => {
    footballClientMock.getFixturesByIds.mockRejectedValue(new Error('quota'));
    await expect(sync.sync()).resolves.toBeUndefined();
    const fixture = await prisma.fixture.findUniqueOrThrow({
      where: { id: fixtureId },
    });
    expect(fixture.status).toBe('SCHEDULED');
  });
});
