import { Component, input, model } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'sc-score-stepper',
  imports: [ButtonModule],
  template: `
    <div class="flex flex-col items-center gap-2" data-testid="score-stepper">
      <span class="font-semibold">{{ label() }}</span>
      <div class="flex items-center gap-3">
        <p-button
          icon="pi pi-minus"
          [rounded]="true"
          severity="secondary"
          (onClick)="decrement()"
          data-testid="stepper-minus"
        />
        <span class="text-3xl font-bold tabular-nums w-12 text-center" data-testid="stepper-value">
          {{ value() }}
        </span>
        <p-button
          icon="pi pi-plus"
          [rounded]="true"
          (onClick)="increment()"
          data-testid="stepper-plus"
        />
      </div>
    </div>
  `,
})
export class ScoreStepperComponent {
  readonly label = input.required<string>();
  readonly value = model(0);

  increment(): void {
    if (this.value() < 99) {
      this.value.update((v) => v + 1);
    }
  }

  decrement(): void {
    if (this.value() > 0) {
      this.value.update((v) => v - 1);
    }
  }
}
