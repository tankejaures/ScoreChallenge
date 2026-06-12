import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestWithUser } from './jwt-auth.guard';

@Injectable()
export class OwnerRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.role !== 'owner') {
      throw new ForbiddenException('Action réservée aux créateurs de groupes');
    }
    return true;
  }
}
