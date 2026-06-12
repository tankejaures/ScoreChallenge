import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/auth.service';
import { AuthStore } from '../../store/auth.store';
import { GroupStore } from '../../store/group.store';

@Component({
  selector: 'sc-group-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule],
  template: `
    <div class="min-h-dvh flex flex-col">
      <header
        class="sc-header sticky top-0 z-10 p-4 flex items-center justify-between"
        data-testid="group-header"
      >
        <div class="flex flex-col gap-1">
          <h1 class="sc-display text-lg leading-tight">{{ store.summary()?.name ?? '…' }}</h1>
          @if (store.summary()?.isOwner) {
            <span class="sc-pill self-start">Organisateur</span>
          }
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm sc-muted">{{ store.summary()?.participantCount ?? 0 }} joueurs</span>
          <p-button
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            ariaLabel="Déconnexion"
            pTooltip="Déconnexion"
            (onClick)="logout()"
            data-testid="group-logout"
          />
        </div>
      </header>

      <main class="flex-1 overflow-y-auto pb-24">
        <router-outlet />
      </main>

      <nav
        class="sc-bottom-nav fixed bottom-0 inset-x-0 flex justify-around items-center py-2 px-1"
        data-testid="group-nav"
      >
        <a
          routerLink="matches"
          routerLinkActive="sc-active"
          class="sc-nav-item flex flex-col items-center text-xs gap-0.5"
        >
          <i class="pi pi-calendar text-base"></i><span>Matchs</span>
        </a>
        <a
          routerLink="ranking"
          routerLinkActive="sc-active"
          class="sc-nav-item flex flex-col items-center text-xs gap-0.5"
        >
          <i class="pi pi-trophy text-base"></i><span>Classement</span>
        </a>
        <a
          routerLink="stats"
          routerLinkActive="sc-active"
          class="sc-nav-item flex flex-col items-center text-xs gap-0.5"
        >
          <i class="pi pi-chart-bar text-base"></i><span>Stats</span>
        </a>
        @if (store.summary()?.isOwner) {
          <a
            routerLink="admin"
            routerLinkActive="sc-active"
            class="sc-nav-item flex flex-col items-center text-xs gap-0.5"
          >
            <i class="pi pi-cog text-base"></i><span>Admin</span>
          </a>
        }
      </nav>
    </div>
  `,
})
export class GroupShellComponent implements OnInit, OnDestroy {
  readonly store = inject(GroupStore);
  private readonly auth = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private get groupId(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.auth.activeGroupId.set(this.groupId);
    this.store.reset();
    void this.store.loadSummary(this.groupId);
  }

  ngOnDestroy(): void {
    this.auth.activeGroupId.set(null);
  }

  logout(): void {
    // Invité : on quitte ce groupe (sa session par code). Organisateur : déconnexion complète.
    if (this.auth.participantSession(this.groupId)) {
      this.authStore.leaveGroup(this.groupId);
    } else {
      this.authStore.logout();
    }
    void this.router.navigate(['/']);
  }
}
