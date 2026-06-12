import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { Participant } from '../../core/models';
import { AdminStore } from '../../store/admin.store';

@Component({
  selector: 'sc-participants-panel',
  imports: [FormsModule, ButtonModule, ConfirmDialogModule, InputTextModule, MessageModule],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <section class="rounded-xl border p-4" data-testid="invite-link-card">
        <h3 class="font-semibold mb-1">Lien d’invitation</h3>
        <p class="text-sm opacity-70 break-all">{{ inviteLink() }}</p>
        <p-button
          label="Copier le lien"
          icon="pi pi-copy"
          size="small"
          styleClass="mt-2"
          (onClick)="copy(inviteLink(), 'Lien copié !')"
          data-testid="copy-invite-link"
        />
      </section>

      @if (store.error()) {
        <p-message severity="error" [text]="store.error()!" />
      }

      <form class="flex gap-2" (ngSubmit)="add()">
        <input
          pInputText
          name="name"
          placeholder="Nom du participant"
          class="flex-1"
          required
          [(ngModel)]="name"
          data-testid="participant-name-input"
        />
        <p-button
          type="submit"
          label="Ajouter"
          [loading]="store.saving()"
          data-testid="participant-add"
        />
      </form>

      <ul class="flex flex-col gap-2">
        @for (participant of store.detail()?.participants ?? []; track participant.id) {
          <li
            class="rounded-xl border p-3 flex items-center justify-between gap-2"
            data-testid="participant-row"
          >
            <div>
              <div class="font-medium">{{ participant.name }}</div>
              <code class="text-sm tracking-widest">{{ participant.code }}</code>
            </div>
            <div class="flex gap-1">
              <p-button
                icon="pi pi-copy"
                [text]="true"
                size="small"
                (onClick)="copy(participant.code ?? '', 'Code copié !')"
                data-testid="copy-code"
              />
              <p-button
                icon="pi pi-trash"
                severity="danger"
                [text]="true"
                size="small"
                (onClick)="remove(participant)"
                data-testid="remove-participant"
              />
            </div>
          </li>
        }
      </ul>
    </div>
  `,
})
export class ParticipantsPanelComponent {
  readonly groupId = input.required<string>();
  readonly store = inject(AdminStore);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  name = '';
  readonly copied = signal(false);

  inviteLink(): string {
    const token = this.store.detail()?.inviteToken ?? '';
    return `${location.origin}/join/${token}`;
  }

  async copy(text: string, confirmation: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    this.messages.add({ severity: 'success', summary: confirmation, life: 2000 });
  }

  async add(): Promise<void> {
    if (!this.name.trim()) {
      return;
    }
    try {
      await this.store.addParticipant(this.groupId(), this.name.trim());
      this.name = '';
    } catch {
      // erreur exposée par store.error()
    }
  }

  remove(participant: Participant): void {
    this.confirmation.confirm({
      message: `Supprimer ${participant.name} ? Ses pronostics seront perdus.`,
      header: 'Confirmation',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => void this.store.removeParticipant(this.groupId(), participant.id),
    });
  }
}
