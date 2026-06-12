import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestWithUser } from '../../auth/jwt-auth.guard';

@Injectable()
export class GroupOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (user?.role !== 'owner') {
      throw new ForbiddenException('Action réservée au créateur du groupe');
    }
    const groupId: string = (request.params['id'] ??
      request.params['groupId']) as string;
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable');
    }
    if (group.ownerId !== user.sub) {
      throw new ForbiddenException('Action réservée au créateur du groupe');
    }
    return true;
  }
}
