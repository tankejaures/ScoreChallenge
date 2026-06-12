import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MatchCardComponent } from '../../shared/match-card.component';
import { PredictionDialogComponent } from './prediction-dialog.component';
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
  imports: [MatchCardComponent, PredictionDialogComponent, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast position="top-center" />
    <sc-prediction-dialog
      [match]="selectedMatch()"
      (close)="selectedMatch.set(null)"
      (saved)="onSaved()"
    />
    <div class="max-w-2xl mx-auto p-4 flex flex-col gap-4 sc-stagger">
      @if (store.loading()) {
        <div class="sc-skeleton h-36"></div>
        <div class="sc-skeleton h-36"></div>
        <div class="sc-skeleton h-36"></div>
      } @else if (store.matches().length === 0) {
        <div class="sc-card p-8 text-center sc-muted" data-testid="empty-matches">
          <div class="text-3xl mb-2">📅</div>
          Aucun match pour l’instant. L’organisateur n’a pas encore créé de match.
        </div>
      }

      @if (live().length > 0) {
        <h2 class="sc-display text-sm uppercase tracking-widest sc-muted">En cours</h2>
        @for (m of live(); track m.id) {
          <sc-match-card [match]="m" />
        }
      }
      @if (upcoming().length > 0) {
        <h2 class="sc-display text-sm uppercase tracking-widest sc-muted">À venir</h2>
        @for (m of upcoming(); track m.id) {
          <sc-match-card [match]="m" [canPredict]="isPredictable(m)" (predict)="open(m)" />
        }
      }
      @if (finished().length > 0) {
        <h2 class="sc-display text-sm uppercase tracking-widest sc-muted">Terminés</h2>
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
  private readonly messageService = inject(MessageService);

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

  onSaved(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Pronostic enregistré ✔',
      life: 2500,
    });
  }
}
