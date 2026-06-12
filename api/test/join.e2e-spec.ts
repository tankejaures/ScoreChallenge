import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { ParticipantJwtPayload } from '../src/auth/jwt-payload.interface';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Join flow (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let inviteToken: string;
  let participantCode: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    ownerToken = await registerOwner(app);
    const group = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CdM 2026' })
      .expect(201);
    inviteToken = (group.body as { inviteToken: string }).inviteToken;
    const participant = await request(app.getHttpServer())
      .post(`/groups/${(group.body as { id: string }).id}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    participantCode = (participant.body as { code: string }).code;
  });

  afterAll(() => app.close());

  it('exposes public group info by invite token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/invite/${inviteToken}`)
      .expect(200);
    const body = res.body as {
      name: string;
      participants?: unknown;
      inviteToken?: unknown;
    };
    expect(body.name).toBe('CdM 2026');
    expect(body.participants).toBeUndefined();
    expect(body.inviteToken).toBeUndefined();
  });

  it('exchanges invite token + code for a participant JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken, code: participantCode })
      .expect(201);
    const body = res.body as {
      token: string;
      groupId: string;
      participant: { name: string };
    };
    expect(body.token).toBeDefined();
    expect(body.participant.name).toBe('Marc');
    expect(body.groupId).toBeDefined();

    const payload = app
      .get(JwtService)
      .verify<ParticipantJwtPayload>(body.token);
    expect(payload.role).toBe('participant');
    expect(payload.groupId).toBe(body.groupId);
  });

  it('accepts lowercase code input', async () => {
    await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken, code: participantCode.toLowerCase() })
      .expect(201);
  });

  it('rejects wrong code with 401', async () => {
    await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken, code: 'XXXXXX' })
      .expect(401);
  });

  it('rejects unknown invite token with 404', async () => {
    await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken: 'doesnotexist', code: participantCode })
      .expect(404);
  });
});
