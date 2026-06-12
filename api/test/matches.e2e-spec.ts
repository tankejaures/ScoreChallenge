import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

export const FUTURE_KICKOFF = '2030-06-15T16:00:00.000Z';
export const FUTURE_DEADLINE = '2030-06-15T15:00:00.000Z';

describe('Matches (e2e)', () => {
  let app: INestApplication<App>;
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
    groupId = (res.body as { id: string }).id;
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
    expect((res.body as { status: string }).status).toBe('UPCOMING');
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
      .patch(
        `/groups/${groupId}/matches/${(created.body as { id: string }).id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ teamB: 'Argentine' })
      .expect(200);
    expect((res.body as { teamB: string }).teamB).toBe('Argentine');
  });
});
