import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

interface SummaryBody {
  id: string;
  name: string;
  description: string | null;
  scoringExactScore: number;
  scoringCorrectOutcome: number;
  scoringOneTeamScore: number;
  participantCount: number;
  isOwner: boolean;
  inviteToken?: string;
}

describe('Group summary (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let groupId: string;
  let inviteToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    ownerToken = await registerOwner(app);
    const group = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'CdM 2026', description: 'Open space' })
      .expect(201);
    groupId = (group.body as { id: string }).id;
    inviteToken = (group.body as { inviteToken: string }).inviteToken;
  });

  afterAll(() => app.close());

  it('returns summary with scoring config and isOwner=true for the owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/summary`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = res.body as SummaryBody;
    expect(body.name).toBe('CdM 2026');
    expect(body.scoringExactScore).toBe(5);
    expect(body.participantCount).toBe(1);
    expect(body.isOwner).toBe(true);
    expect(body.inviteToken).toBeUndefined();
  });

  it('returns summary with isOwner=false for a joined participant', async () => {
    const participant = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    const joined = await request(app.getHttpServer())
      .post('/groups/join')
      .send({ inviteToken, code: (participant.body as { code: string }).code })
      .expect(201);
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/summary`)
      .set(
        'Authorization',
        `Bearer ${(joined.body as { token: string }).token}`,
      )
      .expect(200);
    const body = res.body as SummaryBody;
    expect(body.isOwner).toBe(false);
    expect(body.participantCount).toBe(2);
  });

  it('rejects a participant JWT from another group with 403', async () => {
    const otherOwner = await registerOwner(app, 'other@test.io');
    const otherGroup = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${otherOwner}`)
      .send({ name: 'Autre' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/groups/${(otherGroup.body as { id: string }).id}/summary`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);
  });
});
