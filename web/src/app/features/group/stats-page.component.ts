import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { GroupStore } from '../../store/group.store';

@Component({
  selector: 'sc-stats-page',
  imports: [],
  template: `
    <div class="max-w-2xl mx-auto p-4 flex flex-col gap-6">
      @if (store.myStats(); as mine) {
        <section data-testid="my-stats">
          <h2 class="font-semibold mb-2">Mes statistiques</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl border p-3 text-center">
              <div class="text-2xl font-bold">{{ mine.totalPoints }}</div>
              <div class="text-xs opacity-70">Points</div>
            </div>
            <div class="rounded-xl border p-3 text-center">
              <div class="text-2xl font-bold">{{ mine.rank }}</div>
              <div class="text-xs opacity-70">Position</div>
            </div>
            <div class="rounded-xl border p-3 text-center">
              <div class="text-2xl font-bold">{{ mine.matchesPlayed }}</div>
              <div class="text-xs opacity-70">Pronostiqués</div>
            </div>
            <div class="rounded-xl border p-3 text-center">
              <div class="text-2xl font-bold">{{ mine.exactScores }}</div>
              <div class="text-xs opacity-70">Scores exacts</div>
            </div>
            <div class="rounded-xl border p-3 text-center">
              <div class="text-2xl font-bold">{{ mine.correctOutcomes }}</div>
              <div class="text-xs opacity-70">Bons vainqueurs</div>
            </div>
            <div class="rounded-xl border p-3 text-center">
              <div class="text-2xl font-bold">{{ mine.successRate }} %</div>
              <div class="text-xs opacity-70">Réussite</div>
            </div>
            <div class="rounded-xl border p-3 text-center col-span-2">
              <div class="text-2xl font-bold">{{ mine.averagePoints }}</div>
              <div class="text-xs opacity-70">Moyenne de points par match</div>
            </div>
          </div>
        </section>
      }

      @if (store.stats(); as stats) {
        <section data-testid="group-stats">
          <h2 class="font-semibold mb-2">Le groupe</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl border p-3 text-center">
              <div class="text-2xl font-bold">{{ stats.participantCount }}</div>
              <div class="text-xs opacity-70">Participants</div>
            </div>
            <div class="rounded-xl border p-3 text-center">
              <div class="text-2xl font-bold">{{ stats.matchCount }}</div>
              <div class="text-xs opacity-70">Matchs</div>
            </div>
            <div class="rounded-xl border p-3 text-center">
              <div class="text-2xl font-bold">{{ stats.averagePointsPerPlayer }}</div>
              <div class="text-xs opacity-70">Points / joueur</div>
            </div>
            <div class="rounded-xl border p-3 text-center">
              <div class="text-lg font-bold truncate">{{ stats.bestPlayer?.name ?? '—' }}</div>
              <div class="text-xs opacity-70">Meilleur joueur</div>
            </div>
            <div class="rounded-xl border p-3 text-center col-span-2">
              <div class="text-lg font-bold truncate">
                {{ stats.mostExactScores?.name ?? '—' }}
              </div>
              <div class="text-xs opacity-70">Plus de scores exacts</div>
            </div>
          </div>
        </section>
      } @else {
        <p class="text-center opacity-70">Chargement…</p>
      }
    </div>
  `,
})
export class StatsPageComponent implements OnInit {
  readonly store = inject(GroupStore);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  private get groupId(): string {
    return this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    void this.store.loadStats(this.groupId);
    const session = this.auth.participantSession(this.groupId);
    if (session) {
      void this.store.loadMyStats(this.groupId, session.participant.id);
    }
  }
}
