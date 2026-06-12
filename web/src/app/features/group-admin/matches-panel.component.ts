import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { DatePipe } from '@angular/common';
import { MatchView } from '../../core/models';
import { FixturePickerComponent } from '../../shared/fixture-picker.component';
import { AdminStore } from '../../store/admin.store';
import { GroupStore } from '../../store/group.store';
import { SportsStore } from '../../store/sports.store';

@Component({
  selector: 'sc-matches-panel',
  imports: [
    FormsModule,
    DatePipe,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    TagModule,
    FixturePickerComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      @if (store.error()) {
        <p-message severity="error" [text]="store.error()!" />
      }

      @if (isCompetitionGroup()) {
        <p-button
          label="Ajouter des matchs"
          icon="pi pi-plus"
          (onClick)="openPicker()"
          data-testid="open-fixture-picker"
        />
        <p-dialog
          header="Matchs de la compétition"
          [(visible)]="showPickerValue"
          [modal]="true"
          [style]="{ width: '32rem' }"
        >
          @if (sportsStore.error()) {
            <p-message severity="warn" [text]="sportsStore.error()!" />
          }
          @if (sportsStore.loading()) {
            <div class="sc-skeleton h-24"></div>
          } @else {
            <sc-fixture-picker
              [fixtures]="sportsStore.fixtures()"
              [excludedIds]="importedFixtureIds()"
              [(selected)]="selectedFixtureIds"
            />
          }
          <p-button
            label="Importer"
            styleClass="w-full mt-3"
            [disabled]="selectedFixtureIds().size === 0"
            [loading]="store.saving()"
            (onClick)="importSelection()"
            data-testid="import-fixtures"
          />
        </p-dialog>
      } @else {
        <form class="rounded-xl border p-4 flex flex-col gap-3" (ngSubmit)="create()">
          <h3 class="font-semibold">Nouveau match</h3>
          <div class="flex gap-2">
            <input
              pInputText
              name="teamA"
              placeholder="Équipe A"
              class="flex-1 min-w-0"
              required
              [(ngModel)]="teamA"
              data-testid="match-team-a"
            />
            <input
              pInputText
              name="teamB"
              placeholder="Équipe B"
              class="flex-1 min-w-0"
              required
              [(ngModel)]="teamB"
              data-testid="match-team-b"
            />
          </div>
          <label class="text-sm opacity-70" for="kickoff">Coup d’envoi</label>
          <input
            pInputText
            type="datetime-local"
            id="kickoff"
            name="kickoff"
            required
            [(ngModel)]="kickoffAt"
            data-testid="match-kickoff"
          />
          <label class="text-sm opacity-70" for="deadline">Date limite de pronostic</label>
          <input
            pInputText
            type="datetime-local"
            id="deadline"
            name="deadline"
            required
            [(ngModel)]="predictionDeadline"
            data-testid="match-deadline"
          />
          <p-button
            type="submit"
            label="Créer le match"
            [loading]="store.saving()"
            data-testid="match-create"
          />
        </form>
      }

      <ul class="flex flex-col gap-3">
        @for (match of groupStore.matches(); track match.id) {
          <li class="rounded-xl border p-4 flex flex-col gap-2" data-testid="admin-match-row">
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ match.teamA }} vs {{ match.teamB }}</span>
              <p-tag [value]="statusLabel(match)" />
            </div>
            <span class="text-sm opacity-70">
              {{ match.kickoffAt | date: 'EEE d MMM HH:mm' }}
            </span>

            @if (match.fixtureId) {
              <p class="text-xs sc-muted">⚙️ Score automatique (compétition officielle)</p>
            } @else if (match.status !== 'UPCOMING') {
              <div class="flex items-center gap-2">
                <p-inputnumber
                  [(ngModel)]="resultDrafts[match.id].scoreA"
                  [min]="0"
                  [max]="99"
                  [showButtons]="true"
                  inputStyleClass="w-14 text-center"
                  [name]="'resA-' + match.id"
                  data-testid="result-score-a"
                />
                <span>–</span>
                <p-inputnumber
                  [(ngModel)]="resultDrafts[match.id].scoreB"
                  [min]="0"
                  [max]="99"
                  [showButtons]="true"
                  inputStyleClass="w-14 text-center"
                  [name]="'resB-' + match.id"
                  data-testid="result-score-b"
                />
                <p-button
                  [label]="match.status === 'FINISHED' ? 'Corriger' : 'Valider le score'"
                  size="small"
                  [loading]="store.saving()"
                  (onClick)="saveResult(match)"
                  data-testid="result-save"
                />
              </div>
            }
          </li>
        }
      </ul>
    </div>
  `,
})
export class MatchesPanelComponent implements OnInit {
  readonly groupId = input.required<string>();
  readonly store = inject(AdminStore);
  readonly groupStore = inject(GroupStore);
  readonly sportsStore = inject(SportsStore);
  private readonly messages = inject(MessageService);

  teamA = '';
  teamB = '';
  kickoffAt = '';
  predictionDeadline = '';
  readonly resultDrafts: Record<string, { scoreA: number; scoreB: number }> = {};

  readonly creating = signal(false);
  readonly showPicker = signal(false);
  readonly selectedFixtureIds = signal(new Set<string>());

  readonly isCompetitionGroup = computed(
    () => this.groupStore.summary()?.competitionLeagueId != null,
  );
  readonly importedFixtureIds = computed(() =>
    this.groupStore
      .matches()
      .map((m) => m.fixtureId)
      .filter((id): id is string => id !== null),
  );

  get showPickerValue(): boolean {
    return this.showPicker();
  }
  set showPickerValue(value: boolean) {
    this.showPicker.set(value);
  }

  ngOnInit(): void {
    void this.groupStore.loadMatches(this.groupId()).then(() => this.syncDrafts());
  }

  private syncDrafts(): void {
    for (const match of this.groupStore.matches()) {
      this.resultDrafts[match.id] ??= {
        scoreA: match.finalScoreA ?? 0,
        scoreB: match.finalScoreB ?? 0,
      };
    }
  }

  statusLabel(match: MatchView): string {
    return match.status === 'UPCOMING'
      ? 'À venir'
      : match.status === 'LIVE'
        ? 'En cours'
        : 'Terminé';
  }

  openPicker(): void {
    const summary = this.groupStore.summary();
    if (!summary?.competitionLeagueId || !summary.competitionSeason) {
      return;
    }
    this.selectedFixtureIds.set(new Set());
    this.showPicker.set(true);
    void this.sportsStore.loadFixtures(
      summary.sport,
      summary.competitionLeagueId,
      summary.competitionSeason,
    );
  }

  async importSelection(): Promise<void> {
    try {
      await this.store.importMatches(this.groupId(), [...this.selectedFixtureIds()]);
      this.showPicker.set(false);
      this.syncDrafts();
      this.messages.add({ severity: 'success', summary: 'Matchs importés ✔', life: 2000 });
    } catch {
      // erreur exposée par store.error()
    }
  }

  async create(): Promise<void> {
    if (!this.teamA.trim() || !this.teamB.trim() || !this.kickoffAt || !this.predictionDeadline) {
      return;
    }
    try {
      await this.store.createMatch(this.groupId(), {
        teamA: this.teamA.trim(),
        teamB: this.teamB.trim(),
        kickoffAt: new Date(this.kickoffAt).toISOString(),
        predictionDeadline: new Date(this.predictionDeadline).toISOString(),
      });
      this.teamA = '';
      this.teamB = '';
      this.kickoffAt = '';
      this.predictionDeadline = '';
      this.syncDrafts();
      this.messages.add({ severity: 'success', summary: 'Match créé', life: 2000 });
    } catch {
      // erreur exposée par store.error()
    }
  }

  async saveResult(match: MatchView): Promise<void> {
    const draft = this.resultDrafts[match.id];
    try {
      await this.store.setResult(this.groupId(), match.id, draft.scoreA, draft.scoreB);
      this.messages.add({
        severity: 'success',
        summary: 'Points calculés et classement mis à jour 🏆',
        life: 2500,
      });
    } catch {
      // erreur exposée par store.error()
    }
  }
}
