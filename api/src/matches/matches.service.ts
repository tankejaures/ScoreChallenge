import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Match } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../predictions/scoring.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { SetResultDto } from './dto/set-result.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { getMatchStatus, MatchStatus } from './match-status.util';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
  ) {}

  async create(groupId: string, dto: CreateMatchDto) {
    this.assertDeadlineBeforeKickoff(dto.predictionDeadline, dto.kickoffAt);
    const match = await this.prisma.match.create({
      data: {
        groupId,
        teamA: dto.teamA,
        teamB: dto.teamB,
        kickoffAt: new Date(dto.kickoffAt),
        predictionDeadline: new Date(dto.predictionDeadline),
      },
    });
    return this.withStatus(match);
  }

  async update(groupId: string, matchId: string, dto: UpdateMatchDto) {
    const match = await this.findInGroup(groupId, matchId);
    const kickoffAt = dto.kickoffAt ?? match.kickoffAt.toISOString();
    const predictionDeadline =
      dto.predictionDeadline ?? match.predictionDeadline.toISOString();
    this.assertDeadlineBeforeKickoff(predictionDeadline, kickoffAt);
    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        teamA: dto.teamA,
        teamB: dto.teamB,
        kickoffAt: new Date(kickoffAt),
        predictionDeadline: new Date(predictionDeadline),
      },
    });
    return this.withStatus(updated);
  }

  async setResult(groupId: string, matchId: string, dto: SetResultDto) {
    await this.findInGroup(groupId, matchId);
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
    });
    const config = {
      exactScore: group.scoringExactScore,
      correctOutcome: group.scoringCorrectOutcome,
      oneTeamScore: group.scoringOneTeamScore,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await tx.match.update({
        where: { id: matchId },
        data: { finalScoreA: dto.scoreA, finalScoreB: dto.scoreB },
      });
      const predictions = await tx.prediction.findMany({ where: { matchId } });
      for (const prediction of predictions) {
        const points = this.scoringService.computePoints(
          { a: prediction.scoreA, b: prediction.scoreB },
          { a: dto.scoreA, b: dto.scoreB },
          config,
        );
        await tx.prediction.update({
          where: { id: prediction.id },
          data: { points },
        });
      }
      return match;
    });
    return this.withStatus(updated);
  }

  async findInGroup(groupId: string, matchId: string): Promise<Match> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match || match.groupId !== groupId) {
      throw new NotFoundException('Match introuvable');
    }
    return match;
  }

  private assertDeadlineBeforeKickoff(deadline: string, kickoff: string): void {
    if (new Date(deadline) > new Date(kickoff)) {
      throw new BadRequestException(
        "La date limite de pronostic doit précéder le coup d'envoi",
      );
    }
  }

  private withStatus(match: Match): Match & { status: MatchStatus } {
    return { ...match, status: getMatchStatus(match) };
  }
}
