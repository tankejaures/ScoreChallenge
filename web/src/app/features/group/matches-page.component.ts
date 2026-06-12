import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatchCardComponent } from '../../shared/match-card.component';
import { GroupStore } from '../../store/group.store';
import { MatchView } from '../../core/models';

function canPredict(match: MatchView): boolean {
  if (match.status !== 'UPCOMING') {
    return false;
  }
  if (new Date(match.predictionDeadline).getTime() <= Date.now()) {
    return false;
  }
  return !match.myPrediction || match.myPrediction.editCount === 0;
}

@Component({
  selector: 'sc-matches-page',
  imports: [MatchCardComponent],
  template: `
    <div class="max-w-2xl mx-auto p-4 flex flex-col gap-4">
      @if (store.loading()) {
        <p class="text-center opacity-70">Chargement…</p>
      } @else if (store.matches().length === 0) {
        <p class="text-center opacity-70" data-testid="empty-matches">
          Aucun match pour l’instant. L’organisateur n’a pas encore créé de match.
        </p>
      }

      @if (upcoming().length > 0) {
        <h2 class="font-semibold">À venir</h2>
        @for (m of upcoming(); track m.id) {
          <sc-match-card [match]="m" [canPredict]="isPredictable(m)" (predict)="open(m)" />
        }
      }
      @if (live().length > 0) {
        <h2 class="font-semibold">En cours</h2>
        @for (m of live(); track m.id) {
          <sc-match-card [match]="m" />
        }
      }
      @if (finished().length > 0) {
        <h2 class="font-semibold">Terminés</h2>
        @for (m of finished(); track m.id) {
          <sc-match-card [match]="m" />
        }
      }
    </div>
  `,
})
export class MatchesPageComponent implements OnInit {
  readonly store = inject(GroupStore);
  private readonly route = inject(ActivatedRoute);

  readonly selectedMatch = signal<MatchView | null>(null);

  readonly upcoming = computed(() => this.store.matches().filter((m) => m.status === 'UPCOMING'));
  readonly live = computed(() => this.store.matches().filter((m) => m.status === 'LIVE'));
  readonly finished = computed(() => this.store.matches().filter((m) => m.status === 'FINISHED'));

  protected get groupId(): string {
    return this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    void this.store.loadMatches(this.groupId);
  }

  isPredictable(match: MatchView): boolean {
    return canPredict(match);
  }

  open(match: MatchView): void {
    this.selectedMatch.set(match);
  }
}
