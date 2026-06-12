import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const ownerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

export const groupAccessGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const groupId = route.paramMap.get('id') ?? '';
  return auth.canAccessGroup(groupId) ? true : inject(Router).createUrlTree(['/login']);
};
