import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { AuthStore } from '../../store/auth.store';
import { GroupsStore } from '../../store/groups.store';

@Component({
  selector: 'sc-dashboard',
  imports: [FormsModule, RouterLink, ButtonModule, DialogModule, InputTextModule, TextareaModule],
  template: `
    <div class="max-w-2xl mx-auto p-4 flex flex-col gap-4">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold">Mes groupes</h1>
          <p class="text-sm opacity-70">Bonjour {{ authStore.user()?.name }}</p>
        </div>
        <p-button label="Déconnexion" severity="secondary" [text]="true" (onClick)="logout()" />
      </header>

      <p-button
        label="Créer un groupe"
        icon="pi pi-plus"
        (onClick)="showCreate.set(true)"
        data-testid="create-group-button"
      />

      @if (store.loading()) {
        <p class="text-center opacity-70">Chargement…</p>
      } @else if (store.groups().length === 0) {
        <p class="text-center opacity-70" data-testid="empty-groups">
          Aucun groupe pour l’instant. Créez-en un pour lancer les pronostics !
        </p>
      }

      @for (group of store.groups(); track group.id) {
        <a
          [routerLink]="['/groups', group.id]"
          class="block rounded-xl border p-4 hover:shadow transition"
          data-testid="group-card"
        >
          <div class="font-semibold">{{ group.name }}</div>
          @if (group.description) {
            <div class="text-sm opacity-70">{{ group.description }}</div>
          }
        </a>
      }

      <p-dialog
        header="Nouveau groupe"
        [(visible)]="showCreateValue"
        [modal]="true"
        [style]="{ width: '24rem' }"
      >
        <form class="flex flex-col gap-3" (ngSubmit)="create()">
          <input pInputText name="name" placeholder="Nom du groupe" required [(ngModel)]="name" />
          <textarea
            pTextarea
            name="description"
            placeholder="Description (optionnelle)"
            rows="3"
            [(ngModel)]="description"
          ></textarea>
          <p-button type="submit" label="Créer" [loading]="creating()" />
        </form>
      </p-dialog>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly store = inject(GroupsStore);
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  name = '';
  description = '';

  get showCreateValue(): boolean {
    return this.showCreate();
  }
  set showCreateValue(value: boolean) {
    this.showCreate.set(value);
  }

  ngOnInit(): void {
    void this.store.load();
  }

  async create(): Promise<void> {
    if (!this.name.trim()) {
      return;
    }
    this.creating.set(true);
    try {
      const group = await this.store.create({
        name: this.name.trim(),
        description: this.description.trim() || undefined,
      });
      void this.router.navigate(['/groups', group.id]);
    } finally {
      this.creating.set(false);
    }
  }

  logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/login']);
  }
}
