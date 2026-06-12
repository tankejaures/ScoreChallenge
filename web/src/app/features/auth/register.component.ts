import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'sc-register',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  template: `
    <div class="min-h-dvh flex items-center justify-center p-4">
      <form
        class="w-full max-w-sm flex flex-col gap-4"
        data-testid="register-form"
        (ngSubmit)="submit()"
      >
        <h1 class="text-2xl font-bold text-center">Créer un compte</h1>
        <p class="text-center text-sm opacity-70">
          Pour organiser vos propres concours de pronostics
        </p>
        @if (store.error()) {
          <p-message severity="error" [text]="store.error()!" />
        }
        <input
          pInputText
          name="name"
          placeholder="Votre nom"
          required
          [(ngModel)]="name"
          data-testid="register-name"
        />
        <input
          pInputText
          type="email"
          name="email"
          placeholder="Email"
          required
          [(ngModel)]="email"
          data-testid="register-email"
        />
        <p-password
          name="password"
          placeholder="Mot de passe (8 caractères min.)"
          [toggleMask]="true"
          [(ngModel)]="password"
          data-testid="register-password"
        />
        <p-button
          type="submit"
          label="Créer mon compte"
          [loading]="store.loading()"
          styleClass="w-full"
          data-testid="register-submit"
        />
        <p class="text-center text-sm">
          Déjà un compte ? <a routerLink="/login" class="underline">Se connecter</a>
        </p>
      </form>
    </div>
  `,
})
export class RegisterComponent {
  readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  name = '';
  email = '';
  password = '';

  constructor() {
    this.store.resetMessages();
  }

  async submit(): Promise<void> {
    try {
      await this.store.register(this.email, this.password, this.name);
      void this.router.navigate(['/dashboard']);
    } catch {
      // l'erreur est exposée par store.error()
    }
  }
}
