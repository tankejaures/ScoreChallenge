import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerOwner } from './groups.e2e-spec';
import { createTestApp, resetDb } from './test-utils';

describe('Stats (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerToken: string;
  let groupId: string;
  let ownerParticipantId: string;
  let marcId: string;

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
    ownerParticipantId = (group.body as { participants: Array<{ id: string }> })
      .participants[0].id;
    const marc = await request(app.getHttpServer())
      .post(`/groups/${groupId}/participants`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marc' })
      .expect(201);
    marcId = (marc.body as { id: string }).id;

    // 2 matchs terminés, insérés directement avec points figés :
    // Marc : 5 pts (exact) + 3 pts (vainqueur) = 8 ; Owner : 0 + 3 = 3.
    const past = {
      kickoffAt: new Date('2026-01-01T15:00:00Z'),
      predictionDeadline: new Date('2026-01-01T14:00:00Z'),
    };
    const m1 = await prisma.match.create({
      data: {
        groupId,
        teamA: 'France',
        teamB: 'Brésil',
        ...past,
        finalScoreA: 3,
        finalScoreB: 2,
      },
    });
    const m2 = await prisma.match.create({
      data: {
        groupId,
        teamA: 'Maroc',
        teamB: 'Japon',
        ...past,
        finalScoreA: 1,
        finalScoreB: 0,
      },
    });
    await prisma.prediction.createMany({
      data: [
        {
          matchId: m1.id,
          participantId: marcId,
          scoreA: 3,
          scoreB: 2,
          points: 5,
        },
        {
          matchId: m2.id,
          participantId: marcId,
          scoreA: 2,
          scoreB: 0,
          points: 3,
        },
        {
          matchId: m1.id,
          participantId: ownerParticipantId,
          scoreA: 0,
          scoreB: 1,
          points: 0,
        },
        {
          matchId: m2.id,
          participantId: ownerParticipantId,
          scoreA: 2,
          scoreB: 0,
          points: 3,
        },
      ],
    });
  });

  afterAll(() => app.close());

  it('returns ranking ordered by total points', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/ranking`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = res.body as Array<{
      name: string;
      totalPoints: number;
      rank: number;
      exactScores: number;
      matchesPlayed: number;
      successRate: number;
    }>;
    expect(body[0].name).toBe('Marc');
    expect(body[0].totalPoints).toBe(8);
    expect(body[0].rank).toBe(1);
    expect(body[0].exactScores).toBe(1);
    expect(body[0].matchesPlayed).toBe(2);
    expect(body[0].successRate).toBe(100);
    expect(body[1].totalPoints).toBe(3);
  });

  it('returns individual stats', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/participants/${marcId}/stats`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = res.body as {
      totalPoints: number;
      exactScores: number;
      correctOutcomes: number;
      averagePoints: number;
      rank: number;
    };
    expect(body.totalPoints).toBe(8);
    expect(body.exactScores).toBe(1);
    expect(body.correctOutcomes).toBe(1);
    expect(body.averagePoints).toBe(4);
    expect(body.rank).toBe(1);
  });

  it('returns group stats', async () => {
    const res = await request(app.getHttpServer())
      .get(`/groups/${groupId}/stats`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const body = res.body as {
      participantCount: number;
      matchCount: number;
      bestPlayer: { name: string };
      mostExactScores: { name: string };
      averagePointsPerPlayer: number;
    };
    expect(body.participantCount).toBe(2);
    expect(body.matchCount).toBe(2);
    expect(body.bestPlayer.name).toBe('Marc');
    expect(body.mostExactScores.name).toBe('Marc');
    expect(body.averagePointsPerPlayer).toBe(5.5);
  });
});
