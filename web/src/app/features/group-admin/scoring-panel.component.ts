import { Component, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { AdminStore } from '../../store/admin.store';

@Component({
  selector: 'sc-scoring-panel',
  imports: [FormsModule, ButtonModule, InputNumberModule, MessageModule],
  template: `
    <form class="flex flex-col gap-4" (ngSubmit)="save()">
      @if (store.error()) {
        <p-message severity="error" [text]="store.error()!" />
      }
      <div class="flex items-center justify-between gap-3">
        <label>Score exact</label>
        <p-inputnumber
          name="exact"
          [(ngModel)]="exactScore"
          [min]="0"
          [max]="100"
          [showButtons]="true"
          inputStyleClass="w-16 text-center"
          data-testid="scoring-exact"
        />
      </div>
      <div class="flex items-center justify-between gap-3">
        <label>Bon vainqueur ou bon nul</label>
        <p-inputnumber
          name="outcome"
          [(ngModel)]="correctOutcome"
          [min]="0"
          [max]="100"
          [showButtons]="true"
          inputStyleClass="w-16 text-center"
          data-testid="scoring-outcome"
        />
      </div>
      <div class="flex items-center justify-between gap-3">
        <label>Bon score d’une équipe</label>
        <p-inputnumber
          name="oneTeam"
          [(ngModel)]="oneTeamScore"
          [min]="0"
          [max]="100"
          [showButtons]="true"
          inputStyleClass="w-16 text-center"
          data-testid="scoring-one-team"
        />
      </div>
      <p class="text-sm opacity-70">Le nouveau barème s’applique aux prochains résultats saisis.</p>
      <p-button
        type="submit"
        label="Enregistrer"
        [loading]="store.saving()"
        data-testid="scoring-save"
      />
    </form>
  `,
})
export class ScoringPanelComponent {
  readonly groupId = input.required<string>();
  readonly store = inject(AdminStore);
  private readonly messages = inject(MessageService);

  exactScore = 5;
  correctOutcome = 3;
  oneTeamScore = 1;

  constructor() {
    effect(() => {
      const detail = this.store.detail();
      if (detail) {
        this.exactScore = detail.scoringExactScore;
        this.correctOutcome = detail.scoringCorrectOutcome;
        this.oneTeamScore = detail.scoringOneTeamScore;
      }
    });
  }

  async save(): Promise<void> {
    try {
      await this.store.updateScoring(this.groupId(), {
        scoringExactScore: this.exactScore,
        scoringCorrectOutcome: this.correctOutcome,
        scoringOneTeamScore: this.oneTeamScore,
      });
      this.messages.add({ severity: 'success', summary: 'Barème enregistré', life: 2000 });
    } catch {
      // erreur exposée par store.error()
    }
  }
}
