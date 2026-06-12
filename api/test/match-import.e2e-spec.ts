import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { FUTURE_DEADLINE, FUTURE_KICKOFF } from './matches.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

async function createCompetitionGroup(
  app: INestApplication<App>,
  token: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/groups')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'CdM',
      competition: { leagueId: 1, season: 2026, name: 'World Cup' },
    })
    .expect(201);
  return (res.body as { id: string }).id;
}

async function seedFixture(
  app: INestApplication<App>,
  externalId: number,
  leagueId = 1,
  season = 2026,
): Promise<string> {
  const prisma = app.get(PrismaService);
  const fixture = await prisma.fixture.create({
    data: {
      externalId,
      leagueId,
      season,
      round: 'Group A - 1',
      teamA: 'France',
      teamB: 'Brésil',
      kickoffAt: new Date(FUTURE_KICKOFF),
    },
  });
  return fixture.id;
}

describe('Match import (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    token = await registerOwner(app);
  });

  afterAll(() => app.close());

  it('imports fixtures as group matches with deadline = kickoff', async () => {
    const groupId = await createCompetitionGroup(app, token);
    const fixtureId = await seedFixture(app, 101);
    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    const matches = res.body as {
      teamA: string;
      kickoffAt: string;
      predictionDeadline: string;
      fixtureId: string;
    }[];
    expect(matches).toHaveLength(1);
    expect(matches[0].teamA).toBe('France');
    expect(matches[0].fixtureId).toBe(fixtureId);
    expect(matches[0].predictionDeadline).toBe(matches[0].kickoffAt);
  });

  it('skips fixtures already imported', async () => {
    const groupId = await createCompetitionGroup(app, token);
    const fixtureId = await seedFixture(app, 101);
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    expect(res.body).toHaveLength(0);
  });

  it('rejects fixtures from another competition', async () => {
    const groupId = await createCompetitionGroup(app, token);
    const otherLeagueFixture = await seedFixture(app, 202, 39, 2026);
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [otherLeagueFixture] })
      .expect(400);
  });

  it('rejects import into a free-mode group', async () => {
    const res = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Libre' })
      .expect(201);
    const freeGroupId = (res.body as { id: string }).id;
    const fixtureId = await seedFixture(app, 101);
    await request(app.getHttpServer())
      .post(`/groups/${freeGroupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(400);
  });

  it('rejects manual match creation in a competition group', async () => {
    const groupId = await createCompetitionGroup(app, token);
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        teamA: 'France',
        teamB: 'Brésil',
        kickoffAt: FUTURE_KICKOFF,
        predictionDeadline: FUTURE_DEADLINE,
      })
      .expect(400);
  });

  it('rejects manual result entry on a fixture-linked match', async () => {
    const groupId = await createCompetitionGroup(app, token);
    const fixtureId = await seedFixture(app, 101);
    const imported = await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureIds: [fixtureId] })
      .expect(201);
    const matchId = (imported.body as { id: string }[])[0].id;
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/${matchId}/result`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoreA: 1, scoreB: 0 })
      .expect(400);
  });
});
