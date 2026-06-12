import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './test-utils';

describe('Password reset (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  const credentials = {
    email: 'aline@test.io',
    password: 'password123',
    name: 'Aline',
  };

  it('creates a reset token and allows password change', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: credentials.email })
      .expect(204);

    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: stored.token, password: 'newpassword456' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: 'newpassword456' })
      .expect(201);
  });

  it('returns 204 even for unknown email (no account enumeration)', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'unknown@test.io' })
      .expect(204);
  });

  it('rejects reused token with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: credentials.email })
      .expect(204);
    const stored = await prisma.passwordResetToken.findFirstOrThrow();
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: stored.token, password: 'newpassword456' })
      .expect(204);
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: stored.token, password: 'anotherpass789' })
      .expect(400);
  });
});
