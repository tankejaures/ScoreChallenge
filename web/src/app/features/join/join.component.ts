import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputOtpModule } from 'primeng/inputotp';
import { MessageModule } from 'primeng/message';
import { JoinStore } from '../../store/join.store';

@Component({
  selector: 'sc-join',
  imports: [FormsModule, ButtonModule, InputOtpModule, MessageModule],
  template: `
    <div class="min-h-dvh flex items-center justify-center p-4">
      <div class="w-full max-w-sm flex flex-col gap-4 text-center">
        @if (store.info(); as invite) {
          <h1 class="text-2xl font-bold">{{ invite.name }}</h1>
          @if (invite.description) {
            <p class="opacity-70">{{ invite.description }}</p>
          }
          <p class="text-sm">Entrez votre code personnel pour rejoindre le groupe :</p>
          @if (store.error()) {
            <p-message severity="error" [text]="store.error()!" />
          }
          <form class="flex flex-col items-center gap-4" (ngSubmit)="join()">
            <p-inputotp name="code" [(ngModel)]="code" [length]="6" data-testid="join-code-input" />
            <p-button
              type="submit"
              label="Rejoindre"
              [loading]="store.loading()"
              [disabled]="code.length !== 6"
              styleClass="w-full"
              data-testid="join-submit"
            />
          </form>
        } @else if (store.notFound()) {
          <p-message severity="error" text="Invitation introuvable. Vérifiez le lien reçu." />
        } @else {
          <p class="opacity-70">Chargement…</p>
        }
      </div>
    </div>
  `,
})
export class JoinComponent implements OnInit {
  readonly store = inject(JoinStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  code = '';

  private get inviteToken(): string {
    return this.route.snapshot.paramMap.get('inviteToken') ?? '';
  }

  ngOnInit(): void {
    void this.store.loadInvite(this.inviteToken);
  }

  async join(): Promise<void> {
    try {
      const groupId = await this.store.join(this.inviteToken, this.code);
      void this.router.navigate(['/groups', groupId]);
    } catch {
      // l'erreur est exposée par store.error()
    }
  }
}
