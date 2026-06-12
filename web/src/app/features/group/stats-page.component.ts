import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { GroupStore } from '../../store/group.store';

@Component({
  selector: 'sc-stats-page',
  imports: [],
  template: `
    <div class="max-w-2xl mx-auto p-4 flex flex-col gap-6 sc-stagger">
      @if (store.myStats(); as mine) {
        <section data-testid="my-stats">
          <h2 class="sc-display text-sm uppercase tracking-widest sc-muted mb-2">Mes statistiques</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="sc-card p-3 text-center">
              <div class="sc-score text-2xl">{{ mine.totalPoints }}</div>
              <div class="text-xs sc-muted">Points</div>
            </div>
            <div class="sc-card p-3 text-center">
              <div class="sc-score text-2xl">{{ mine.rank }}</div>
              <div class="text-xs sc-muted">Position</div>
            </div>
            <div class="sc-card p-3 text-center">
              <div class="sc-score text-2xl">{{ mine.matchesPlayed }}</div>
              <div class="text-xs sc-muted">Pronostiqués</div>
            </div>
            <div class="sc-card p-3 text-center">
              <div class="sc-score text-2xl">{{ mine.exactScores }}</div>
              <div class="text-xs sc-muted">Scores exacts</div>
            </div>
            <div class="sc-card p-3 text-center">
              <div class="sc-score text-2xl">{{ mine.correctOutcomes }}</div>
              <div class="text-xs sc-muted">Bons vainqueurs</div>
            </div>
            <div class="sc-card p-3 text-center">
              <div class="sc-score text-2xl">{{ mine.successRate }} %</div>
              <div class="text-xs sc-muted">Réussite</div>
            </div>
            <div class="sc-card p-3 text-center col-span-2">
              <div class="sc-score text-2xl">{{ mine.averagePoints }}</div>
              <div class="text-xs sc-muted">Moyenne de points par match</div>
            </div>
          </div>
        </section>
      }

      @if (store.stats(); as stats) {
        <section data-testid="group-stats">
          <h2 class="sc-display text-sm uppercase tracking-widest sc-muted mb-2">Le groupe</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="sc-card p-3 text-center">
              <div class="sc-score text-2xl">{{ stats.participantCount }}</div>
              <div class="text-xs sc-muted">Participants</div>
            </div>
            <div class="sc-card p-3 text-center">
              <div class="sc-score text-2xl">{{ stats.matchCount }}</div>
              <div class="text-xs sc-muted">Matchs</div>
            </div>
            <div class="sc-card p-3 text-center">
              <div class="sc-score text-2xl">{{ stats.averagePointsPerPlayer }}</div>
              <div class="text-xs sc-muted">Points / joueur</div>
            </div>
            <div class="sc-card p-3 text-center">
              <div class="sc-display text-lg truncate">{{ stats.bestPlayer?.name ?? '—' }}</div>
              <div class="text-xs sc-muted">Meilleur joueur</div>
            </div>
            <div class="sc-card p-3 text-center col-span-2">
              <div class="sc-display text-lg truncate">
                {{ stats.mostExactScores?.name ?? '—' }}
              </div>
              <div class="text-xs sc-muted">Plus de scores exacts</div>
            </div>
          </div>
        </section>
      } @else {
        <div class="sc-skeleton h-40"></div>
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
