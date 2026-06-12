import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, resetDb } from './test-utils';

export async function registerOwner(
  app: INestApplication<App>,
  email = 'owner@test.io',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'password123', name: 'Owner' })
    .expect(201);
  return (res.body as { token: string }).token;
}

describe('Groups (e2e)', () => {
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

  it('creates a group with invite token and owner as participant', async () => {
    const res = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CdM 2026', description: 'Open space' })
      .expect(201);
    const body = res.body as {
      inviteToken: string;
      scoringExactScore: number;
      participants: Array<{ name: string; code: string }>;
    };
    expect(body.inviteToken).toHaveLength(12);
    expect(body.scoringExactScore).toBe(5);
    expect(body.participants).toHaveLength(1);
    expect(body.participants[0].name).toBe('Owner');
    expect(body.participants[0].code).toHaveLength(6);
  });

  it('lists my groups only', async () => {
    await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Groupe A' })
      .expect(201);
    const otherToken = await registerOwner(app, 'other@test.io');
    await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Groupe B' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = res.body as Array<{ name: string }>;
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Groupe A');
  });

  it('updates name, description and scoring config', async () => {
    const created = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .patch(`/groups/${(created.body as { id: string }).id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scoringExactScore: 10 })
      .expect(200);
    expect((res.body as { scoringExactScore: number }).scoringExactScore).toBe(
      10,
    );
  });

  it('forbids access to a group I do not own', async () => {
    const created = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    const otherToken = await registerOwner(app, 'other@test.io');
    await request(app.getHttpServer())
      .patch(`/groups/${(created.body as { id: string }).id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Pirate' })
      .expect(403);
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get('/groups').expect(401);
  });
});
