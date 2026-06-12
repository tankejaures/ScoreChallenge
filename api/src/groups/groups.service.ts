import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Group } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { generateInviteToken } from '../common/codes.util';
import { ParticipantsService } from '../participants/participants.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import type {
  JwtPayload,
  ParticipantJwtPayload,
} from '../auth/jwt-payload.interface';

@Injectable()
export class GroupsService {
  private static readonly PARTICIPANT_TOKEN_TTL = '90d';

  constructor(
    private readonly prisma: PrismaService,
    private readonly participantsService: ParticipantsService,
    private readonly jwtService: JwtService,
  ) {}

  async create(ownerId: string, dto: CreateGroupDto) {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUniqueOrThrow({ where: { id: ownerId } });
      const { competition, ...groupData } = dto;
      const group = await tx.group.create({
        data: {
          ...groupData,
          ownerId,
          inviteToken: generateInviteToken(),
          competitionLeagueId: competition?.leagueId ?? null,
          competitionSeason: competition?.season ?? null,
          competitionName: competition?.name ?? null,
        },
      });
      await this.participantsService.createWithUniqueCode(tx, {
        groupId: group.id,
        name: owner.name,
        userId: ownerId,
      });
      return tx.group.findUniqueOrThrow({
        where: { id: group.id },
        include: { participants: true },
      });
    });
  }

  findMine(ownerId: string): Promise<Group[]> {
    return this.prisma.group.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { participants: { orderBy: { createdAt: 'asc' } } },
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable');
    }
    return group;
  }

  update(groupId: string, dto: UpdateGroupDto) {
    return this.prisma.group.update({ where: { id: groupId }, data: dto });
  }

  async getSummary(groupId: string, user: JwtPayload) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { _count: { select: { participants: true } } },
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable');
    }
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      scoringExactScore: group.scoringExactScore,
      scoringCorrectOutcome: group.scoringCorrectOutcome,
      scoringOneTeamScore: group.scoringOneTeamScore,
      competitionLeagueId: group.competitionLeagueId,
      competitionSeason: group.competitionSeason,
      competitionName: group.competitionName,
      participantCount: group._count.participants,
      isOwner: user.role === 'owner' && group.ownerId === user.sub,
    };
  }

  async getPublicInfoByInviteToken(inviteToken: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteToken },
      select: { name: true, description: true },
    });
    if (!group) {
      throw new NotFoundException('Invitation introuvable');
    }
    return group;
  }

  async join(dto: JoinGroupDto) {
    const group = await this.prisma.group.findUnique({
      where: { inviteToken: dto.inviteToken },
    });
    if (!group) {
      throw new NotFoundException('Invitation introuvable');
    }
    const participant = await this.prisma.participant.findUnique({
      where: {
        groupId_code: { groupId: group.id, code: dto.code.toUpperCase() },
      },
    });
    if (!participant) {
      throw new UnauthorizedException('Code invalide');
    }
    const payload: ParticipantJwtPayload = {
      sub: participant.id,
      groupId: group.id,
      role: 'participant',
    };
    return {
      token: this.jwtService.sign(payload, {
        expiresIn: GroupsService.PARTICIPANT_TOKEN_TTL,
      }),
      groupId: group.id,
      participant: { id: participant.id, name: participant.name },
    };
  }
}
