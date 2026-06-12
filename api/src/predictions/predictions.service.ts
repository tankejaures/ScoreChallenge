import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Participant, Prediction, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPredictionDto } from './dto/upsert-prediction.dto';

@Injectable()
export class PredictionsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertForMatch(
    user: JwtPayload,
    matchId: string,
    dto: UpsertPredictionDto,
  ): Promise<Prediction> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match) {
      throw new NotFoundException('Match introuvable');
    }
    if (match.finalScoreA !== null) {
      throw new ForbiddenException('Le résultat final est déjà enregistré');
    }
    if (new Date() > match.predictionDeadline) {
      throw new ForbiddenException('La date limite de pronostic est dépassée');
    }

    const participant = await this.resolveParticipant(user, match.groupId);

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.prediction.findUnique({
          where: {
            matchId_participantId: { matchId, participantId: participant.id },
          },
        });
        if (!existing) {
          return tx.prediction.create({
            data: {
              matchId,
              participantId: participant.id,
              scoreA: dto.scoreA,
              scoreB: dto.scoreB,
            },
          });
        }
        if (existing.editCount >= 1) {
          throw new ForbiddenException(
            'Pronostic verrouillé : une seule modification autorisée',
          );
        }
        return tx.prediction.update({
          where: { id: existing.id },
          data: {
            scoreA: dto.scoreA,
            scoreB: dto.scoreB,
            editCount: 1,
            lockedAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async resolveParticipant(
    user: JwtPayload,
    groupId: string,
  ): Promise<Participant> {
    if (user.role === 'participant') {
      if (user.groupId !== groupId) {
        throw new ForbiddenException(
          'Ce match n’appartient pas à votre groupe',
        );
      }
      const participant = await this.prisma.participant.findUnique({
        where: { id: user.sub },
      });
      if (!participant) {
        throw new ForbiddenException('Participant introuvable');
      }
      return participant;
    }
    const participant = await this.prisma.participant.findFirst({
      where: { groupId, userId: user.sub },
    });
    if (!participant) {
      throw new ForbiddenException('Vous n’êtes pas participant de ce groupe');
    }
    return participant;
  }
}
