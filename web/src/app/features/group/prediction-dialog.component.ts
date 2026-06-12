import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { ScoreStepperComponent } from '../../shared/score-stepper.component';
import { GroupStore } from '../../store/group.store';
import { MatchView } from '../../core/models';

@Component({
  selector: 'sc-prediction-dialog',
  imports: [ButtonModule, DialogModule, MessageModule, ScoreStepperComponent],
  template: `
    <p-dialog
      [header]="title()"
      [visible]="match() !== null"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '22rem' }"
      data-testid="prediction-dialog"
    >
      @if (match(); as m) {
        @if (isLastEdit()) {
          <p-message
            severity="warn"
            text="Dernière modification possible !"
            styleClass="mb-3 w-full"
            data-testid="last-edit-warning"
          />
        }
        @if (error()) {
          <p-message severity="error" [text]="error()!" styleClass="mb-3 w-full" />
        }
        <div class="flex items-start justify-center gap-6 py-2">
          <sc-score-stepper [label]="m.teamA" [(value)]="scoreA" />
          <span class="text-2xl font-bold self-center">–</span>
          <sc-score-stepper [label]="m.teamB" [(value)]="scoreB" />
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <p-button label="Annuler" severity="secondary" [text]="true" (onClick)="close.emit()" />
          <p-button
            label="Valider"
            [loading]="saving()"
            (onClick)="save()"
            data-testid="prediction-save"
          />
        </div>
      }
    </p-dialog>
  `,
})
export class PredictionDialogComponent {
  readonly match = input<MatchView | null>(null);
  readonly close = output<void>();
  readonly saved = output<void>();

  private readonly store = inject(GroupStore);

  scoreA = signal(0);
  scoreB = signal(0);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly title = computed(() => {
    const m = this.match();
    return m ? `${m.teamA} vs ${m.teamB}` : '';
  });

  readonly isLastEdit = computed(() => {
    const m = this.match();
    return !!m?.myPrediction && m.myPrediction.editCount === 0;
  });

  constructor() {
    effect(() => {
      const m = this.match();
      this.error.set(null);
      this.scoreA.set(m?.myPrediction?.scoreA ?? 0);
      this.scoreB.set(m?.myPrediction?.scoreB ?? 0);
    });
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.close.emit();
    }
  }

  async save(): Promise<void> {
    const m = this.match();
    if (!m) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.store.submitPrediction(m.id, this.scoreA(), this.scoreB());
      this.saved.emit();
      this.close.emit();
    } catch {
      this.error.set('Pronostic verrouillé ou date limite dépassée');
    } finally {
      this.saving.set(false);
    }
  }
}
