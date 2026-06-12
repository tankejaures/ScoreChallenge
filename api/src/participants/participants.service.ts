import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { generateParticipantCode } from '../common/codes.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParticipantDto } from './dto/create-participant.dto';

const MAX_CODE_ATTEMPTS = 5;
export const MAX_PARTICIPANTS_PER_GROUP = 50;

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async createWithUniqueCode(
    tx: Prisma.TransactionClient,
    data: { groupId: string; name: string; userId?: string },
  ) {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        return await tx.participant.create({
          data: { ...data, code: generateParticipantCode() },
        });
      } catch (error) {
        const isCodeCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!isCodeCollision || attempt === MAX_CODE_ATTEMPTS - 1) {
          throw error;
        }
      }
    }
    throw new Error('unreachable');
  }

  async addToGroup(groupId: string, dto: CreateParticipantDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const count = await tx.participant.count({ where: { groupId } });
        if (count >= MAX_PARTICIPANTS_PER_GROUP) {
          throw new ConflictException(
            `Limite de ${MAX_PARTICIPANTS_PER_GROUP} participants atteinte pour ce groupe`,
          );
        }
        return this.createWithUniqueCode(tx, { groupId, name: dto.name });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async remove(groupId: string, participantId: string): Promise<void> {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
    });
    if (!participant || participant.groupId !== groupId) {
      throw new NotFoundException('Participant introuvable');
    }
    await this.prisma.participant.delete({ where: { id: participantId } });
  }
}
