import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, resetDb } from './test-utils';

describe('Full flow (e2e)', () => {
  let app: INestApplication<App>;

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
    const ownerToken = (auth.body as { token: string }).token;
    const group = await request(server)
      .post('/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CdM 2026 — Open Space' })
      .expect(201);
    const groupId = (group.body as { id: string }).id;

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
      .send({
        inviteToken: (group.body as { inviteToken: string }).inviteToken,
        code: (marc.body as { code: string }).code,
      })
      .expect(201);
    await request(server)
      .put(`/matches/${(match.body as { id: string }).id}/prediction`)
      .set(
        'Authorization',
        `Bearer ${(joined.body as { token: string }).token}`,
      )
      .send({ scoreA: 3, scoreB: 2 })
      .expect(200);

    // 4. Aline pronostique 1-1, puis saisit le résultat 3-2
    await request(server)
      .put(`/matches/${(match.body as { id: string }).id}/prediction`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scoreA: 1, scoreB: 1 })
      .expect(200);
    await request(server)
      .post(
        `/groups/${groupId}/matches/${(match.body as { id: string }).id}/result`,
      )
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scoreA: 3, scoreB: 2 })
      .expect(201);

    // 5. Classement : Marc 5 pts (exact), Aline 0
    const ranking = await request(server)
      .get(`/groups/${groupId}/ranking`)
      .set(
        'Authorization',
        `Bearer ${(joined.body as { token: string }).token}`,
      )
      .expect(200);
    const rankingBody = ranking.body as Array<{
      name: string;
      totalPoints: number;
    }>;
    expect(rankingBody[0].name).toBe('Marc');
    expect(rankingBody[0].totalPoints).toBe(5);
    expect(rankingBody[1].name).toBe('Aline');
    expect(rankingBody[1].totalPoints).toBe(0);
  });
});
