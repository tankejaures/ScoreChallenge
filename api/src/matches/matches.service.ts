import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Match } from '@prisma/client';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { PredictionsService } from '../predictions/predictions.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { MatchSettlementService } from './match-settlement.service';
import { SetResultDto } from './dto/set-result.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { getMatchStatus, MatchStatus } from './match-status.util';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementService: MatchSettlementService,
    private readonly predictionsService: PredictionsService,
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
    const updated = await this.settlementService.settle(
      matchId,
      dto.scoreA,
      dto.scoreB,
    );
    return this.withStatus(updated);
  }

  async listForGroup(groupId: string, user: JwtPayload) {
    const me = await this.predictionsService.resolveParticipant(user, groupId);
    const matches = await this.prisma.match.findMany({
      where: { groupId },
      orderBy: { kickoffAt: 'asc' },
      include: {
        predictions: {
          include: { participant: { select: { id: true, name: true } } },
        },
      },
    });
    const now = new Date();
    return matches.map((match) => {
      // Pronostics révélés après la deadline OU dès que le résultat est saisi
      // (tout est alors verrouillé, plus rien à copier).
      const revealed =
        now > match.predictionDeadline || match.finalScoreA !== null;
      const { predictions, ...rest } = match;
      return {
        ...rest,
        status: getMatchStatus(match, now),
        myPrediction:
          predictions.find((p) => p.participantId === me.id) ?? null,
        predictions: revealed ? predictions : [],
      };
    });
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
        'La date limite de pronostic doit précéder le coup d’envoi',
      );
    }
  }

  private withStatus(match: Match): Match & { status: MatchStatus } {
    return { ...match, status: getMatchStatus(match) };
  }
}
