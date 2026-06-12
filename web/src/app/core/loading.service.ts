import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pendingCount = signal(0);

  readonly isLoading = computed(() => this.pendingCount() > 0);

  start(): void {
    this.pendingCount.update((count) => count + 1);
  }

  stop(): void {
    this.pendingCount.update((count) => Math.max(0, count - 1));
  }
}
