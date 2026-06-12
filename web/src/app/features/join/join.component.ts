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
      <div class="w-full max-w-sm flex flex-col gap-5 text-center sc-fade-up">
        @if (store.info(); as invite) {
          <div class="sc-pill self-center">🎟 Vous êtes invité·e</div>
          <h1 class="sc-display text-3xl leading-tight">{{ invite.name }}</h1>
          @if (invite.description) {
            <p class="sc-muted">{{ invite.description }}</p>
          }
          <div class="sc-card-raised p-6 flex flex-col gap-4">
            <p class="text-sm sc-muted">Entrez votre code personnel pour entrer sur le terrain :</p>
            @if (store.error()) {
              <p-message severity="error" [text]="store.error()!" />
            }
            <form class="flex flex-col items-center gap-4" (ngSubmit)="join()">
              <p-inputotp
                name="code"
                [(ngModel)]="code"
                [length]="6"
                data-testid="join-code-input"
              />
              <p-button
                type="submit"
                label="Rejoindre le groupe"
                [loading]="store.loading()"
                [disabled]="code.length !== 6"
                styleClass="w-full"
                data-testid="join-submit"
              />
            </form>
          </div>
          <p class="text-xs sc-muted">Pas de code ? Demandez-le à l’organisateur du groupe.</p>
        } @else if (store.notFound()) {
          <p-message severity="error" text="Invitation introuvable. Vérifiez le lien reçu." />
        } @else {
          <div class="sc-skeleton h-48"></div>
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
