import { Component, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TableModule } from 'primeng/table';
import { AuthService } from '../../core/auth.service';
import { GroupStore } from '../../store/group.store';

@Component({
  selector: 'sc-ranking-page',
  imports: [TableModule],
  template: `
    <div class="max-w-2xl mx-auto p-4 flex flex-col gap-6">
      @if (podium().length > 0) {
        <div class="flex items-end justify-center gap-2 pt-4 overflow-hidden" data-testid="podium">
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
    </div>
  `,
})
export class RankingPageComponent implements OnInit {
  readonly store = inject(GroupStore);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly podium = computed(() => this.store.ranking().slice(0, 3));

  private get groupId(): string {
    return this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  readonly myParticipantId = computed(
    () => this.auth.participantSession(this.groupId)?.participant.id ?? null,
  );

  ngOnInit(): void {
    void this.store.loadRanking(this.groupId);
  }
}
