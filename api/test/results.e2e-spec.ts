import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { FUTURE_DEADLINE, FUTURE_KICKOFF } from './matches.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Match results (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let groupId: string;
  let inviteToken: string;
  let matchId: string;
  let participantId: string;
  let participantCode: string;

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
    groupId = (group.body as { id: string }).id;
    inviteToken = (group.body as { inviteToken: string }).inviteToken;
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
    matchId = (match.body as { id: string }).id;
    const participant = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Marc' })
      .expect(201);
    participantId = (participant.body as { id: string }).id;
    participantCode = (participant.body as { code: string }).code;
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
    expect((res.body as { status: string }).status).toBe('FINISHED');

    const prediction = await prisma.prediction.findFirstOrThrow({
      where: { participantId },
    });
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

    const prediction = await prisma.prediction.findFirstOrThrow({
      where: { participantId },
    });
    expect(prediction.points).toBe(1); // seul le score de l'équipe B (2) est bon
  });

  it('rejects unauthenticated result entry', async () => {
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/${matchId}/result`)
      .send({ scoreA: 1, scoreB: 0 })
      .expect(401);
  });

  it('forbids a joined participant from setting result', async () => {
    const joined = await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken, code: participantCode })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/matches/${matchId}/result`)
      .set(
        'Authorization',
        `Bearer ${(joined.body as { token: string }).token}`,
      )
      .send({ scoreA: 1, scoreB: 0 })
      .expect(403);
  });
});
