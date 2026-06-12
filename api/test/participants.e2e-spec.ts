import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Participants (e2e)', () => {
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

  it('adds a participant with a generated 6-char code', async () => {
    const res = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Marc' })
      .expect(201);
    const body = res.body as { name: string; code: string };
    expect(body.name).toBe('Marc');
    expect(body.code).toHaveLength(6);
  });

  it('removes a participant', async () => {
    const created = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Marc' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(
        `/groups/${groupId}/participants/${(created.body as { id: string }).id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('rejects participant #51 with 409', async () => {
    const prisma = app.get(PrismaService);
    // Le groupe a déjà 1 participant (l'owner) : on en insère 49 de plus.
    await prisma.participant.createMany({
      data: Array.from({ length: 49 }, (_, i) => ({
        groupId,
        name: `Joueur ${i}`,
        code: `TEST${String(i).padStart(2, '0')}`,
      })),
    });
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Un de trop' })
      .expect(409);
  });

  it('rejects deleting a participant of another group with 404', async () => {
    const otherGroup = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Autre groupe' })
      .expect(201);
    const otherGroupId = (otherGroup.body as { id: string }).id;
    const otherParticipant = await request(app.getHttpServer())
      .post(`/groups/${otherGroupId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Léa' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(
        `/groups/${groupId}/participants/${(otherParticipant.body as { id: string }).id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
