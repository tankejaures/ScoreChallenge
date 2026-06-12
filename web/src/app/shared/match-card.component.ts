import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { interval, map, startWith } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MatchStatus, MatchView } from '../core/models';
import { formatCountdown } from './countdown';

const STATUS_LABEL: Record<MatchStatus, { label: string; severity: 'info' | 'warn' | 'success' }> =
  {
    UPCOMING: { label: 'À venir', severity: 'info' },
    LIVE: { label: 'En cours', severity: 'warn' },
    FINISHED: { label: 'Terminé', severity: 'success' },
  };

@Component({
  selector: 'sc-match-card',
  imports: [DatePipe, ButtonModule, TagModule],
  template: `
    <article
      class="sc-card sc-lift p-4 flex flex-col gap-3"
      [class.sc-live]="match().status === 'LIVE'"
      data-testid="match-card"
    >
      <div class="flex items-center justify-between">
        <p-tag
          [value]="statusInfo().label"
          [severity]="statusInfo().severity"
          data-testid="match-status"
        />
        <span class="text-sm sc-muted">{{ match().kickoffAt | date: 'EEE d MMM HH:mm' }}</span>
      </div>

      <div class="flex items-center justify-center gap-3 text-lg">
        <span class="flex-1 text-right sc-display">{{ match().teamA }}</span>
        @if (match().status === 'FINISHED') {
          <span class="sc-score text-3xl" data-testid="final-score">
            {{ match().finalScoreA }} – {{ match().finalScoreB }}
          </span>
        } @else {
          <span class="sc-muted text-sm uppercase tracking-widest">vs</span>
        }
        <span class="flex-1 sc-display">{{ match().teamB }}</span>
      </div>

      @if (match().myPrediction; as prediction) {
        <div class="text-center text-sm sc-muted" data-testid="my-prediction">
          Mon pronostic :
          <strong class="sc-score text-base" style="color: var(--sc-text)">
            {{ prediction.scoreA }} – {{ prediction.scoreB }}
          </strong>
          @if (prediction.points !== null) {
            <span class="ml-2 sc-score" style="color: var(--sc-volt-400)">
              +{{ prediction.points }} pts
            </span>
          }
        </div>
      }

      @if (countdown(); as remaining) {
        <p class="text-center text-xs" style="color: var(--sc-volt-400)" data-testid="countdown">
          ⏱ Fin des pronostics dans {{ remaining }}
        </p>
      }

      @if (canPredict()) {
        <p-button
          [label]="match().myPrediction ? 'Modifier mon pronostic' : 'Pronostiquer'"
          styleClass="w-full"
          (onClick)="predict.emit()"
          data-testid="predict-button"
        />
        @if (match().myPrediction && match().myPrediction!.editCount === 0) {
          <p class="text-center text-xs sc-muted">1 modification possible</p>
        }
      } @else if (match().status !== 'FINISHED' && match().myPrediction) {
        <p class="text-center text-xs sc-muted">🔒 Pronostic verrouillé</p>
      }

      @if (match().predictions.length > 0) {
        <details class="text-sm">
          <summary class="cursor-pointer sc-muted">
            Pronostics du groupe ({{ match().predictions.length }})
          </summary>
          <ul class="mt-2 flex flex-col gap-1">
            @for (p of match().predictions; track p.id) {
              <li class="flex justify-between border-b border-white/5 pb-1">
                <span>{{ p.participant?.name }}</span>
                <span class="sc-score">
                  {{ p.scoreA }} – {{ p.scoreB }}
                  @if (p.points !== null) {
                    <strong class="ml-1" style="color: var(--sc-volt-400)">+{{ p.points }}</strong>
                  }
                </span>
              </li>
            }
          </ul>
        </details>
      }
    </article>
  `,
})
export class MatchCardComponent {
  readonly match = input.required<MatchView>();
  readonly canPredict = input(false);
  readonly predict = output<void>();

  private readonly tick = toSignal(
    interval(30_000).pipe(
      startWith(0),
      map(() => Date.now()),
    ),
    { initialValue: Date.now() },
  );

  readonly statusInfo = computed(() => STATUS_LABEL[this.match().status]);
  readonly countdown = computed(() => {
    this.tick();
    if (this.match().status !== 'UPCOMING') {
      return null;
    }
    return formatCountdown(new Date(this.match().predictionDeadline));
  });
}
