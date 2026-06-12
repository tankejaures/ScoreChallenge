import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { FUTURE_DEADLINE, FUTURE_KICKOFF } from './matches.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Predictions (e2e)', () => {
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
  });

  afterAll(() => app.close());

  function submit(token: string, scores: { scoreA: number; scoreB: number }) {
    return request(app.getHttpServer())
      .put(`/matches/${matchId}/prediction`)
      .set('Authorization', `Bearer ${token}`)
      .send(scores);
  }

  it('submits an initial prediction (editCount 0)', async () => {
    const res = await submit(participantToken, { scoreA: 2, scoreB: 1 }).expect(
      200,
    );
    expect((res.body as { scoreA: number }).scoreA).toBe(2);
    expect((res.body as { editCount: number }).editCount).toBe(0);
  });

  it('allows exactly one modification then locks', async () => {
    await submit(participantToken, { scoreA: 2, scoreB: 1 }).expect(200);
    const second = await submit(participantToken, {
      scoreA: 3,
      scoreB: 0,
    }).expect(200);
    expect((second.body as { editCount: number }).editCount).toBe(1);
    expect((second.body as { lockedAt: string | null }).lockedAt).toBeDefined();
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
    expect((res.body as { scoreA: number }).scoreA).toBe(1);
  });

  it('rejects participant from another group', async () => {
    const otherOwner = await registerOwner(app, 'other@test.io');
    const otherGroup = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${otherOwner}`)
      .send({ name: 'Autre groupe' })
      .expect(201);
    const stranger = await request(app.getHttpServer())
      .post(`/groups/${(otherGroup.body as { id: string }).id}/participants`)
      .set('Authorization', `Bearer ${otherOwner}`)
      .send({ name: 'Intrus' })
      .expect(201);
    const joined = await request(app.getHttpServer())
      .post('/groups/join')
      .send({
        inviteToken: (otherGroup.body as { inviteToken: string }).inviteToken,
        code: (stranger.body as { code: string }).code,
      })
      .expect(201);
    await submit((joined.body as { token: string }).token, {
      scoreA: 2,
      scoreB: 1,
    }).expect(403);
  });
});
