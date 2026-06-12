import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/auth.service';
import { MatchView, Prediction } from '../../core/models';
import { sortPredictionsForRanking } from '../../shared/prediction-ranking';
import { GroupStore } from '../../store/group.store';

type RankingView = 'general' | 'matches';

interface MatchRanking {
  match: MatchView;
  predictions: Prediction[];
}

@Component({
  selector: 'sc-ranking-page',
  imports: [DatePipe, FormsModule, SelectButtonModule, TableModule, TagModule],
  template: `
    <div class="max-w-2xl mx-auto p-4 flex flex-col gap-6">
      <p-selectbutton
        [options]="viewOptions"
        [(ngModel)]="viewValue"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        styleClass="self-center"
        data-testid="ranking-view-switch"
      />

      @if (view() === 'general') {
        @if (podium().length > 0) {
          <div
            class="flex items-end justify-center gap-2 pt-4 overflow-hidden"
            data-testid="podium"
          >
            @if (podium()[1]; as second) {
              <div class="flex-1 text-center sc-podium-step" style="animation-delay: 0.15s">
                <div
                  class="rounded-t-2xl py-5 border-t-4"
                  style="background: var(--sc-pitch-700); border-color: var(--sc-silver)"
                >
                  <div class="text-3xl">🥈</div>
                  <div class="sc-display truncate px-1">{{ second.name }}</div>
                  <div class="sc-score text-lg" style="color: var(--sc-silver)">
                    {{ second.totalPoints }} pts
                  </div>
                </div>
              </div>
            }
            @if (podium()[0]; as first) {
              <div class="flex-1 text-center sc-podium-step">
                <div class="text-2xl mb-1">👑</div>
                <div
                  class="rounded-t-2xl py-9 border-t-4"
                  style="
                    background: linear-gradient(180deg, var(--sc-pitch-600), var(--sc-pitch-700));
                    border-color: var(--sc-gold);
                    box-shadow: 0 0 30px rgba(245, 200, 76, 0.18);
                  "
                >
                  <div class="text-4xl">🥇</div>
                  <div class="sc-display text-lg truncate px-1">{{ first.name }}</div>
                  <div class="sc-score text-2xl" style="color: var(--sc-gold)">
                    {{ first.totalPoints }} pts
                  </div>
                </div>
              </div>
            }
            @if (podium()[2]; as third) {
              <div class="flex-1 text-center sc-podium-step" style="animation-delay: 0.3s">
                <div
                  class="rounded-t-2xl py-3 border-t-4"
                  style="background: var(--sc-pitch-800); border-color: var(--sc-bronze)"
                >
                  <div class="text-3xl">🥉</div>
                  <div class="sc-display truncate px-1">{{ third.name }}</div>
                  <div class="sc-score" style="color: var(--sc-bronze)">
                    {{ third.totalPoints }} pts
                  </div>
                </div>
              </div>
            }
          </div>
        }

        <p-table [value]="store.ranking()" [rowHover]="true" data-testid="ranking-table">
          <ng-template #header>
            <tr>
              <th>#</th>
              <th>Joueur</th>
              <th class="text-right">Pts</th>
              <th class="text-right">Joués</th>
              <th class="text-right">Corrects</th>
              <th class="text-right">Exacts</th>
              <th class="text-right">%</th>
            </tr>
          </ng-template>
          <ng-template #body let-entry>
            <tr [class.font-bold]="entry.id === myParticipantId()">
              <td>{{ entry.rank }}</td>
              <td>{{ entry.name }}</td>
              <td class="text-right tabular-nums">{{ entry.totalPoints }}</td>
              <td class="text-right tabular-nums">{{ entry.matchesPlayed }}</td>
              <td class="text-right tabular-nums">{{ entry.correctPredictions }}</td>
              <td class="text-right tabular-nums">{{ entry.exactScores }}</td>
              <td class="text-right tabular-nums">{{ entry.successRate }} %</td>
            </tr>
          </ng-template>
        </p-table>
      } @else {
        @if (matchRankings().length === 0) {
          <div class="sc-card p-8 text-center sc-muted" data-testid="empty-match-rankings">
            <div class="text-3xl mb-2">⏱</div>
            Les pronostics du groupe apparaissent ici dès la fin des pronostics de chaque match.
          </div>
        }
        <div class="flex flex-col gap-4 sc-stagger">
          @for (entry of matchRankings(); track entry.match.id) {
            <section class="sc-card p-4 flex flex-col gap-3" data-testid="match-ranking-card">
              <header class="flex items-center justify-between gap-2">
                <span class="sc-display">
                  {{ entry.match.teamA }}
                  @if (entry.match.status === 'FINISHED') {
                    <span class="sc-score mx-1">
                      {{ entry.match.finalScoreA }} – {{ entry.match.finalScoreB }}
                    </span>
                  } @else {
                    <span class="sc-muted mx-1 text-sm">vs</span>
                  }
                  {{ entry.match.teamB }}
                </span>
                @if (entry.match.status === 'FINISHED') {
                  <p-tag value="Terminé" severity="success" />
                } @else {
                  <p-tag value="En attente du score" severity="warn" />
                }
              </header>
              <p class="text-xs sc-muted -mt-2">
                {{ entry.match.kickoffAt | date: 'EEE d MMM HH:mm' }}
              </p>
              <ol class="flex flex-col">
                @for (p of entry.predictions; track p.id; let i = $index) {
                  <li
                    class="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0"
                    [class.font-bold]="p.participantId === myParticipantId()"
                    data-testid="match-ranking-row"
                  >
                    <span class="flex items-center gap-2 min-w-0">
                      <span class="sc-score w-6 text-center sc-muted">{{ i + 1 }}</span>
                      <span class="truncate">{{ p.participant?.name }}</span>
                    </span>
                    <span class="sc-score whitespace-nowrap">
                      {{ p.scoreA }} – {{ p.scoreB }}
                      @if (p.points !== null) {
                        <strong class="ml-2" style="color: var(--sc-volt-400)">
                          +{{ p.points }} pts
                        </strong>
                      } @else {
                        <span class="ml-2 text-xs sc-muted">en attente</span>
                      }
                    </span>
                  </li>
                }
              </ol>
            </section>
          }
        </div>
      }
    </div>
  `,
})
export class RankingPageComponent implements OnInit {
  readonly store = inject(GroupStore);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly viewOptions: { label: string; value: RankingView }[] = [
    { label: 'Général', value: 'general' },
    { label: 'Par match', value: 'matches' },
  ];
  readonly view = signal<RankingView>('general');

  get viewValue(): RankingView {
    return this.view();
  }
  set viewValue(value: RankingView) {
    this.view.set(value);
  }

  readonly podium = computed(() => this.store.ranking().slice(0, 3));

  // Matchs dont les pronostics sont révélés (deadline passée), du plus récent au plus ancien.
  readonly matchRankings = computed<MatchRanking[]>(() =>
    this.store
      .matches()
      .filter((match) => match.predictions.length > 0)
      .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime())
      .map((match) => ({ match, predictions: sortPredictionsForRanking(match.predictions) })),
  );

  private get groupId(): string {
    return this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  readonly myParticipantId = computed(
    () => this.auth.participantSession(this.groupId)?.participant.id ?? null,
  );

  ngOnInit(): void {
    void this.store.loadRanking(this.groupId);
    void this.store.loadMatches(this.groupId);
  }
}
