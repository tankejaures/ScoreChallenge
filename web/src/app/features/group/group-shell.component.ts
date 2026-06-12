import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { GroupStore } from '../../store/group.store';

@Component({
  selector: 'sc-group-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
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
        <span class="text-sm sc-muted">{{ store.summary()?.participantCount ?? 0 }} joueurs</span>
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
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const groupId = this.route.snapshot.paramMap.get('id') ?? '';
    this.auth.activeGroupId.set(groupId);
    this.store.reset();
    void this.store.loadSummary(groupId);
  }

  ngOnDestroy(): void {
    this.auth.activeGroupId.set(null);
  }
}
