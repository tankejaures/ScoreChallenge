import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'sc-forgot-password',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule],
  template: `
    <div class="min-h-dvh flex items-center justify-center p-4">
      <form
        class="w-full max-w-sm flex flex-col gap-4 sc-card-raised p-6 sc-fade-up"
        data-testid="forgot-form"
        (ngSubmit)="submit()"
      >
        <h1 class="sc-display text-2xl text-center">Mot de passe oublié</h1>
        @if (store.infoMessage()) {
          <p-message severity="success" [text]="store.infoMessage()!" />
        } @else {
          <p class="text-center text-sm opacity-70">
            Entrez votre email, nous vous enverrons un lien de réinitialisation.
          </p>
        }
        <input
          pInputText
          type="email"
          name="email"
          placeholder="Email"
          required
          [(ngModel)]="email"
          data-testid="forgot-email"
        />
        <p-button
          type="submit"
          label="Envoyer le lien"
          [loading]="store.loading()"
          styleClass="w-full"
          data-testid="forgot-submit"
        />
        <p class="text-center text-sm">
          <a routerLink="/login" class="underline">Retour à la connexion</a>
        </p>
      </form>
    </div>
  `,
})
export class ForgotPasswordComponent {
  readonly store = inject(AuthStore);

  email = '';

  constructor() {
    this.store.resetMessages();
  }

  async submit(): Promise<void> {
    await this.store.forgotPassword(this.email);
  }
}
