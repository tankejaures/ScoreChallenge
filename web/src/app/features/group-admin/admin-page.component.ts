import { Component, OnInit, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TabsModule } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { AdminStore } from '../../store/admin.store';
import { GroupStore } from '../../store/group.store';
import { MatchesPanelComponent } from './matches-panel.component';
import { ParticipantsPanelComponent } from './participants-panel.component';
import { ScoringPanelComponent } from './scoring-panel.component';

@Component({
  selector: 'sc-admin-page',
  imports: [
    TabsModule,
    ToastModule,
    MatchesPanelComponent,
    ParticipantsPanelComponent,
    ScoringPanelComponent,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast position="top-center" />
    <div class="max-w-2xl mx-auto p-4">
      <p-tabs value="participants">
        <p-tablist>
          <p-tab value="participants">Participants</p-tab>
          <p-tab value="matches">Matchs</p-tab>
          <p-tab value="scoring">Barème</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel value="participants">
            <sc-participants-panel [groupId]="groupId" />
          </p-tabpanel>
          <p-tabpanel value="matches">
            <sc-matches-panel [groupId]="groupId" />
          </p-tabpanel>
          <p-tabpanel value="scoring">
            <sc-scoring-panel [groupId]="groupId" />
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>
  `,
})
export class AdminPageComponent implements OnInit {
  readonly store = inject(AdminStore);
  private readonly groupStore = inject(GroupStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  get groupId(): string {
    return this.route.parent?.snapshot.paramMap.get('id') ?? '';
  }

  constructor() {
    effect(() => {
      const summary = this.groupStore.summary();
      if (summary && !summary.isOwner) {
        void this.router.navigate(['/groups', this.groupId, 'matches']);
      }
    });
  }

  ngOnInit(): void {
    void this.store.reload(this.groupId);
  }
}
