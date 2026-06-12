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
    <article class="rounded-xl border p-4 flex flex-col gap-3" data-testid="match-card">
      <div class="flex items-center justify-between">
        <p-tag
          [value]="statusInfo().label"
          [severity]="statusInfo().severity"
          data-testid="match-status"
        />
        <span class="text-sm opacity-70">{{ match().kickoffAt | date: 'EEE d MMM HH:mm' }}</span>
      </div>

      <div class="flex items-center justify-center gap-3 text-lg font-semibold">
        <span class="flex-1 text-right">{{ match().teamA }}</span>
        @if (match().status === 'FINISHED') {
          <span class="text-2xl tabular-nums" data-testid="final-score">
            {{ match().finalScoreA }} – {{ match().finalScoreB }}
          </span>
        } @else {
          <span class="opacity-40">vs</span>
        }
        <span class="flex-1">{{ match().teamB }}</span>
      </div>

      @if (match().myPrediction; as prediction) {
        <div class="text-center text-sm" data-testid="my-prediction">
          Mon pronostic : <strong>{{ prediction.scoreA }} – {{ prediction.scoreB }}</strong>
          @if (prediction.points !== null) {
            <span class="ml-2 font-bold">+{{ prediction.points }} pts</span>
          }
        </div>
      }

      @if (countdown(); as remaining) {
        <p class="text-center text-xs opacity-70" data-testid="countdown">
          Fin des pronostics dans {{ remaining }}
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
          <p class="text-center text-xs opacity-70">1 modification possible</p>
        }
      } @else if (match().status !== 'FINISHED' && match().myPrediction) {
        <p class="text-center text-xs opacity-70">Pronostic verrouillé</p>
      }

      @if (match().predictions.length > 0) {
        <details class="text-sm">
          <summary class="cursor-pointer opacity-70">
            Pronostics du groupe ({{ match().predictions.length }})
          </summary>
          <ul class="mt-2 flex flex-col gap-1">
            @for (p of match().predictions; track p.id) {
              <li class="flex justify-between">
                <span>{{ p.participant?.name }}</span>
                <span class="tabular-nums">
                  {{ p.scoreA }} – {{ p.scoreB }}
                  @if (p.points !== null) {
                    <strong class="ml-1">+{{ p.points }}</strong>
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
