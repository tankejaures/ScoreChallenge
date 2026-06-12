import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { LoadingService } from '../core/loading.service';

@Component({
  selector: 'sc-loading-bar',
  styles: `
    .sc-loading-track {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 9999;
      background: transparent;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .sc-loading-track.sc-visible {
      opacity: 1;
    }

    @keyframes sc-loading-slide {
      0% {
        left: -40%;
        width: 40%;
      }
      50% {
        left: 30%;
        width: 50%;
      }
      100% {
        left: 100%;
        width: 40%;
      }
    }

    .sc-loading-thumb {
      position: absolute;
      top: 0;
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, var(--sc-volt-400), var(--sc-volt-500));
      box-shadow: 0 0 10px rgba(212, 246, 58, 0.6);
      animation: sc-loading-slide 1.1s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .sc-loading-thumb {
        animation-duration: 2.2s;
      }
    }
  `,
  template: `
    <div
      class="sc-loading-track"
      [class.sc-visible]="visible()"
      role="progressbar"
      aria-label="Chargement en cours"
      data-testid="global-loading-bar"
    >
      @if (visible()) {
        <div class="sc-loading-thumb"></div>
      }
    </div>
  `,
})
export class LoadingBarComponent {
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);

  private readonly navigating = toSignal(
    this.router.events.pipe(
      filter(
        (event) =>
          event instanceof NavigationStart ||
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      map((event) => event instanceof NavigationStart),
    ),
    { initialValue: false },
  );

  readonly visible = computed(() => this.loading.isLoading() || this.navigating());
}
