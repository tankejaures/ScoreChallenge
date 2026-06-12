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
        <div class="flex items-end justify-center gap-3" data-testid="podium">
          @if (podium()[1]; as second) {
            <div class="flex-1 text-center">
              <div class="rounded-t-xl bg-gray-200 py-4">
                <div class="text-2xl">🥈</div>
                <div class="font-semibold truncate px-1">{{ second.name }}</div>
                <div class="text-sm opacity-70">{{ second.totalPoints }} pts</div>
              </div>
            </div>
          }
          @if (podium()[0]; as first) {
            <div class="flex-1 text-center">
              <div class="rounded-t-xl bg-amber-200 py-8">
                <div class="text-3xl">🥇</div>
                <div class="font-bold truncate px-1">{{ first.name }}</div>
                <div class="text-sm opacity-70">{{ first.totalPoints }} pts</div>
              </div>
            </div>
          }
          @if (podium()[2]; as third) {
            <div class="flex-1 text-center">
              <div class="rounded-t-xl bg-orange-200 py-2">
                <div class="text-2xl">🥉</div>
                <div class="font-semibold truncate px-1">{{ third.name }}</div>
                <div class="text-sm opacity-70">{{ third.totalPoints }} pts</div>
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
