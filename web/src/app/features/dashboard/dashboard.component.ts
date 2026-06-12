import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../../core/api.service';
import { Competition, Sport } from '../../core/models';
import { FixturePickerComponent } from '../../shared/fixture-picker.component';
import { SPORT_META, SPORTS } from '../../shared/sport';
import { AuthStore } from '../../store/auth.store';
import { GroupsStore } from '../../store/groups.store';
import { SportsStore } from '../../store/sports.store';

@Component({
  selector: 'sc-dashboard',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    TextareaModule,
    FixturePickerComponent,
  ],
  template: `
    <div class="max-w-2xl mx-auto p-4 flex flex-col gap-4 sc-stagger">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="sc-wordmark text-2xl">ScoreChallenge</h1>
          <p class="text-sm sc-muted">Bonjour {{ authStore.user()?.name }} 👋</p>
        </div>
        <p-button label="Déconnexion" severity="secondary" [text]="true" (onClick)="logout()" />
      </header>

      <p-button
        label="Créer un groupe"
        icon="pi pi-plus"
        (onClick)="showCreate.set(true)"
        data-testid="create-group-button"
      />

      @if (store.loading()) {
        <div class="sc-skeleton h-20"></div>
        <div class="sc-skeleton h-20"></div>
      } @else if (store.groups().length === 0) {
        <div class="sc-card p-8 text-center sc-muted" data-testid="empty-groups">
          <div class="text-3xl mb-2">⚽️</div>
          Aucun groupe pour l’instant. Créez-en un pour lancer les pronostics !
        </div>
      }

      @for (group of store.groups(); track group.id) {
        <a
          [routerLink]="['/groups', group.id]"
          class="sc-card sc-lift block p-4"
          data-testid="group-card"
        >
          <div class="sc-display text-lg">{{ group.name }}</div>
          @if (group.competitionName) {
            <div class="text-xs sc-muted">
              {{ sportMeta[group.sport].icon }} {{ group.competitionName }}
            </div>
          }
          @if (group.description) {
            <div class="text-sm sc-muted">{{ group.description }}</div>
          }
        </a>
      }

      <p-dialog
        header="Nouveau groupe"
        [(visible)]="showCreateValue"
        [modal]="true"
        [style]="{ width: '32rem' }"
      >
        @if (step() === 1) {
          <form class="flex flex-col gap-3" (ngSubmit)="next()">
            <input pInputText name="name" placeholder="Nom du groupe" required [(ngModel)]="name" />
            <textarea
              pTextarea
              name="description"
              placeholder="Description (optionnelle)"
              rows="3"
              [(ngModel)]="description"
            ></textarea>

            <fieldset class="flex flex-col gap-2">
              <legend class="text-sm sc-muted mb-1">Type de challenge (définitif)</legend>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" value="custom" [(ngModel)]="mode" />
                Matchs personnalisés (saisie manuelle)
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" value="competition" [(ngModel)]="mode" />
                Compétition officielle (scores automatiques)
              </label>
            </fieldset>

            <p-button
              type="submit"
              [label]="mode === 'competition' ? 'Suivant' : 'Créer'"
              [loading]="creating()"
              data-testid="group-create-next"
            />
          </form>
        } @else {
          <div class="flex flex-col gap-3">
            <div class="grid grid-cols-3 gap-2">
              @for (sport of sports; track sport) {
                <button
                  type="button"
                  class="sc-card p-3 text-center cursor-pointer"
                  [style.outline]="
                    selectedSport() === sport ? '2px solid var(--sc-volt-400)' : 'none'
                  "
                  (click)="selectSport(sport)"
                  [attr.data-testid]="'sport-' + sport"
                >
                  <div class="text-2xl">{{ sportMeta[sport].icon }}</div>
                  <div class="text-xs sc-muted">{{ sportMeta[sport].label }}</div>
                </button>
              }
            </div>

            @if (sportsStore.error()) {
              <p-message severity="warn" [text]="sportsStore.error()!" />
            }
            @if (selectedSport()) {
              <p-select
                [options]="sportsStore.competitions()"
                optionLabel="name"
                placeholder="Choisir une compétition"
                [filter]="true"
                [ngModel]="selectedCompetition()"
                (ngModelChange)="onCompetitionChange($event)"
                name="competition"
                data-testid="competition-select"
              >
                <ng-template #item let-competition>
                  <span class="flex items-center gap-2">
                    @if (competition.logo) {
                      <img [src]="competition.logo" alt="" class="h-4 w-4" />
                    }
                    {{ competition.name }}
                    <span class="text-xs sc-muted">{{ competition.country }}</span>
                  </span>
                </ng-template>
              </p-select>
            }

            @if (sportsStore.loading()) {
              <div class="sc-skeleton h-24"></div>
            } @else if (selectedCompetition()) {
              <sc-fixture-picker
                [fixtures]="sportsStore.fixtures()"
                [(selected)]="selectedFixtureIds"
              />
            }

            <div class="flex gap-2">
              <p-button
                label="Retour"
                severity="secondary"
                [text]="true"
                (onClick)="step.set(1)"
              />
              <p-button
                label="Créer le groupe"
                class="flex-1"
                [disabled]="!selectedCompetition() || selectedFixtureIds().size === 0"
                [loading]="creating()"
                (onClick)="create()"
                data-testid="group-create-submit"
              />
            </div>
          </div>
        }
      </p-dialog>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly store = inject(GroupsStore);
  readonly authStore = inject(AuthStore);
  readonly sportsStore = inject(SportsStore);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly step = signal<1 | 2>(1);
  readonly selectedSport = signal<Sport | null>(null);
  readonly selectedCompetition = signal<Competition | null>(null);
  readonly selectedFixtureIds = signal(new Set<string>());
  protected readonly sports = SPORTS;
  protected readonly sportMeta = SPORT_META;
  name = '';
  description = '';
  mode: 'custom' | 'competition' = 'custom';

  get showCreateValue(): boolean {
    return this.showCreate();
  }
  set showCreateValue(value: boolean) {
    this.showCreate.set(value);
    if (!value) {
      this.resetWizard();
    }
  }

  ngOnInit(): void {
    void this.store.load();
  }

  next(): void {
    if (!this.name.trim()) {
      return;
    }
    if (this.mode === 'custom') {
      void this.create();
      return;
    }
    this.step.set(2);
  }

  selectSport(sport: Sport): void {
    this.selectedSport.set(sport);
    this.selectedCompetition.set(null);
    this.selectedFixtureIds.set(new Set());
    this.sportsStore.resetFixtures();
    void this.sportsStore.loadCompetitions(sport);
  }

  onCompetitionChange(competition: Competition | null): void {
    this.selectedCompetition.set(competition);
    this.selectedFixtureIds.set(new Set());
    const sport = this.selectedSport();
    if (competition && sport) {
      void this.sportsStore.loadFixtures(sport, competition.leagueId, competition.season);
    }
  }

  async create(): Promise<void> {
    this.creating.set(true);
    try {
      const competition = this.selectedCompetition();
      const group = await this.store.create({
        name: this.name.trim(),
        description: this.description.trim() || undefined,
        competition:
          this.mode === 'competition' && competition && this.selectedSport()
            ? {
                sport: this.selectedSport()!,
                leagueId: competition.leagueId,
                season: competition.season,
                name: competition.name,
              }
            : undefined,
      });
      if (this.mode === 'competition') {
        await firstValueFrom(
          this.api.importMatches(group.id, [...this.selectedFixtureIds()]),
        );
      }
      void this.router.navigate(['/groups', group.id]);
    } finally {
      this.creating.set(false);
    }
  }

  private resetWizard(): void {
    this.step.set(1);
    this.mode = 'custom';
    this.selectedSport.set(null);
    this.selectedCompetition.set(null);
    this.selectedFixtureIds.set(new Set());
    this.sportsStore.resetFixtures();
  }

  logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/login']);
  }
}
