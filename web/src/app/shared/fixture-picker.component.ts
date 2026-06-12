import { DatePipe } from '@angular/common';
import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FixtureView } from '../core/models';

interface RoundGroup {
  round: string;
  fixtures: FixtureView[];
}

@Component({
  selector: 'sc-fixture-picker',
  imports: [DatePipe, FormsModule, ButtonModule, CheckboxModule],
  template: `
    <div class="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
      @for (group of rounds(); track group.round) {
        <section class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold sc-muted">{{ group.round }}</h4>
            <p-button
              label="Tout sélectionner"
              [text]="true"
              size="small"
              (onClick)="selectRound(group)"
            />
          </div>
          @for (fixture of group.fixtures; track fixture.id) {
            <label
              class="flex items-center gap-3 rounded-lg border p-2 cursor-pointer"
              data-testid="fixture-row"
            >
              <p-checkbox
                [binary]="true"
                [ngModel]="selected().has(fixture.id)"
                (ngModelChange)="toggle(fixture.id, $event)"
                [name]="'fixture-' + fixture.id"
              />
              <span class="flex-1 flex items-center gap-2">
                @if (fixture.teamALogo) {
                  <img [src]="fixture.teamALogo" alt="" class="h-5 w-5" />
                }
                {{ fixture.teamA }}
                <span class="sc-muted text-xs">vs</span>
                @if (fixture.teamBLogo) {
                  <img [src]="fixture.teamBLogo" alt="" class="h-5 w-5" />
                }
                {{ fixture.teamB }}
              </span>
              <span class="text-xs sc-muted">
                {{ fixture.kickoffAt | date: 'EEE d MMM HH:mm' }}
              </span>
            </label>
          }
        </section>
      }
    </div>
  `,
})
export class FixturePickerComponent {
  readonly fixtures = input.required<FixtureView[]>();
  // Ids des fixtures à masquer (déjà importées)
  readonly excludedIds = input<readonly string[]>([]);
  readonly selected = model(new Set<string>());

  readonly rounds = computed<RoundGroup[]>(() => {
    const excluded = new Set(this.excludedIds());
    const visible = this.fixtures().filter((f) => !excluded.has(f.id));
    const byRound = new Map<string, FixtureView[]>();
    for (const fixture of visible) {
      const round = fixture.round ?? 'Autres matchs';
      byRound.set(round, [...(byRound.get(round) ?? []), fixture]);
    }
    return [...byRound.entries()].map(([round, fixtures]) => ({ round, fixtures }));
  });

  toggle(fixtureId: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) {
      next.add(fixtureId);
    } else {
      next.delete(fixtureId);
    }
    this.selected.set(next);
  }

  selectRound(group: RoundGroup): void {
    const next = new Set(this.selected());
    for (const fixture of group.fixtures) {
      next.add(fixture.id);
    }
    this.selected.set(next);
  }
}
