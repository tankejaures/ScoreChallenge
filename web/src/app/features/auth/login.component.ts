import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'sc-login',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  template: `
    <div class="min-h-dvh flex items-center justify-center p-4">
      <form
        class="w-full max-w-sm flex flex-col gap-4"
        data-testid="login-form"
        (ngSubmit)="submit()"
      >
        <h1 class="text-2xl font-bold text-center">ScoreChallenge</h1>
        <p class="text-center text-sm opacity-70">Connexion organisateur</p>
        @if (store.error()) {
          <p-message severity="error" [text]="store.error()!" />
        }
        <input
          pInputText
          type="email"
          name="email"
          placeholder="Email"
          required
          [(ngModel)]="email"
          data-testid="login-email"
        />
        <p-password
          name="password"
          placeholder="Mot de passe"
          [feedback]="false"
          [toggleMask]="true"
          [(ngModel)]="password"
          data-testid="login-password"
        />
        <p-button
          type="submit"
          label="Se connecter"
          [loading]="store.loading()"
          styleClass="w-full"
          data-testid="login-submit"
        />
        <div class="flex justify-between text-sm">
          <a routerLink="/register" class="underline">Créer un compte</a>
          <a routerLink="/forgot-password" class="underline">Mot de passe oublié ?</a>
        </div>
      </form>
    </div>
  `,
})
export class LoginComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  email = '';
  password = '';

  constructor() {
    this.store.resetMessages();
  }

  async submit(): Promise<void> {
    try {
      await this.store.login(this.email, this.password);
      void this.router.navigate(['/dashboard']);
    } catch {
      // l'erreur est exposée par store.error()
    }
  }
}
