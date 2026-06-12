import { Routes } from '@angular/router';
import { groupAccessGuard, ownerGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    canActivate: [ownerGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'join/:inviteToken',
    loadComponent: () => import('./features/join/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'groups/:id',
    canActivate: [groupAccessGuard],
    loadComponent: () =>
      import('./features/group/group-shell.component').then((m) => m.GroupShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'matches' },
      {
        path: 'matches',
        loadComponent: () =>
          import('./features/group/matches-page.component').then((m) => m.MatchesPageComponent),
      },
      {
        path: 'ranking',
        loadComponent: () =>
          import('./features/group/ranking-page.component').then((m) => m.RankingPageComponent),
      },
      {
        path: 'stats',
        loadComponent: () =>
          import('./features/group/stats-page.component').then((m) => m.StatsPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
