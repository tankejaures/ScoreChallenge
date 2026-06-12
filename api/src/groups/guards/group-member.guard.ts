import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RequestWithUser } from '../../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GroupMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const groupId: string = (request.params['id'] ??
      request.params['groupId']) as string;

    if (user?.role === 'participant') {
      if (user.groupId !== groupId) {
        throw new ForbiddenException('Accès limité à votre groupe');
      }
      return true;
    }
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable');
    }
    if (group.ownerId !== user?.sub) {
      throw new ForbiddenException('Accès limité à vos groupes');
    }
    return true;
  }
}
