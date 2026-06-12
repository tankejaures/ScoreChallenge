import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'sc-reset-password',
  imports: [FormsModule, RouterLink, ButtonModule, PasswordModule, MessageModule],
  template: `
    <div class="min-h-dvh flex items-center justify-center p-4">
      <form
        class="w-full max-w-sm flex flex-col gap-4 sc-card-raised p-6 sc-fade-up"
        data-testid="reset-form"
        (ngSubmit)="submit()"
      >
        <h1 class="sc-display text-2xl text-center">Nouveau mot de passe</h1>
        @if (store.error()) {
          <p-message severity="error" [text]="store.error()!" />
        }
        @if (store.infoMessage()) {
          <p-message severity="success" [text]="store.infoMessage()!" />
          <p class="text-center text-sm">
            <a routerLink="/login" class="underline">Se connecter</a>
          </p>
        } @else {
          <p-password
            name="password"
            placeholder="Nouveau mot de passe (8 caractères min.)"
            [toggleMask]="true"
            [(ngModel)]="password"
            data-testid="reset-password-input"
          />
          <p-button
            type="submit"
            label="Mettre à jour"
            [loading]="store.loading()"
            styleClass="w-full"
            data-testid="reset-submit"
          />
        }
      </form>
    </div>
  `,
})
export class ResetPasswordComponent {
  readonly store = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);

  password = '';

  constructor() {
    this.store.resetMessages();
  }

  async submit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    try {
      await this.store.resetPassword(token, this.password);
    } catch {
      // l'erreur est exposée par store.error()
    }
  }
}
