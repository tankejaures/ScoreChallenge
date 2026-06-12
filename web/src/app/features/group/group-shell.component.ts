import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { GroupStore } from '../../store/group.store';

@Component({
  selector: 'sc-group-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-dvh flex flex-col">
      <header class="p-4 border-b flex items-center justify-between" data-testid="group-header">
        <div>
          <h1 class="font-bold text-lg">{{ store.summary()?.name ?? '…' }}</h1>
          @if (store.summary()?.isOwner) {
            <span class="text-xs rounded-full border px-2 py-0.5">Organisateur</span>
          }
        </div>
        <span class="text-sm opacity-70">
          {{ store.summary()?.participantCount ?? 0 }} joueurs
        </span>
      </header>

      <main class="flex-1 overflow-y-auto pb-20">
        <router-outlet />
      </main>

      <nav
        class="fixed bottom-0 inset-x-0 border-t bg-white flex justify-around py-2"
        data-testid="group-nav"
      >
        <a
          routerLink="matches"
          routerLinkActive="font-bold"
          class="flex flex-col items-center text-sm"
        >
          <i class="pi pi-calendar"></i><span>Matchs</span>
        </a>
        <a
          routerLink="ranking"
          routerLinkActive="font-bold"
          class="flex flex-col items-center text-sm"
        >
          <i class="pi pi-trophy"></i><span>Classement</span>
        </a>
        <a
          routerLink="stats"
          routerLinkActive="font-bold"
          class="flex flex-col items-center text-sm"
        >
          <i class="pi pi-chart-bar"></i><span>Stats</span>
        </a>
        @if (store.summary()?.isOwner) {
          <a
            routerLink="admin"
            routerLinkActive="font-bold"
            class="flex flex-col items-center text-sm"
          >
            <i class="pi pi-cog"></i><span>Admin</span>
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
