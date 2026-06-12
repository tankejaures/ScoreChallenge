import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { FUTURE_DEADLINE, FUTURE_KICKOFF } from './matches.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Match list with prediction visibility (e2e)', () => {
  let app: INestApplication<App>;
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
    groupId = (group.body as { id: string }).id;
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
    matchId = (match.body as { id: string }).id;
    const participant = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    const joined = await request(app.getHttpServer())
      .post('/groups/join')
      .send({
        inviteToken: (group.body as { inviteToken: string }).inviteToken,
        code: (participant.body as { code: string }).code,
      })
      .expect(201);
    participantToken = (joined.body as { token: string }).token;

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
    const match = (
      res.body as Array<{
        myPrediction: { scoreA: number };
        predictions: unknown[];
      }>
    )[0];
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
    const body = res.body as Array<{
      predictions: Array<{ participant: { name: string } }>;
    }>;
    expect(body[0].predictions).toHaveLength(2);
    expect(body[0].predictions[0].participant.name).toBeDefined();
  });

  it('rejects a participant JWT from another group', async () => {
    const otherOwner = await registerOwner(app, 'other@test.io');
    const otherGroup = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${otherOwner}`)
      .send({ name: 'Autre' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/groups/${(otherGroup.body as { id: string }).id}/matches`)
      .set('Authorization', `Bearer ${participantToken}`)
      .expect(403);
  });
});
