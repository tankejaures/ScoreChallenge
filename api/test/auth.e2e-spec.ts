import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthResult } from '../src/auth/auth.service';
import { createTestApp, resetDb } from './test-utils';

type AuthResponseBody = AuthResult & {
  user: AuthResult['user'] & { passwordHash?: string };
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => resetDb(app));
  afterAll(() => app.close());

  const credentials = {
    email: 'aline@test.io',
    password: 'password123',
    name: 'Aline',
  };

  it('registers a user and returns a token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    const body = res.body as AuthResponseBody;
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe(credentials.email);
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email with 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(409);
  });

  it('rejects invalid registration payload with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '' })
      .expect(400);
  });

  it('logs in with valid credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(201);
    expect((res.body as AuthResponseBody).token).toBeDefined();
  });

  it('rejects wrong password with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' })
      .expect(401);
  });
});
