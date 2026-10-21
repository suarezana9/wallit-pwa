import { Component, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

export interface ChipOption {
  value: string;
  label: string;
  emoji?: string;
}

@Component({
  selector: 'app-chip-picker',
  template: `
    <div class="chips" role="radiogroup" [attr.aria-label]="label()" [class.invalid]="invalid() && touched()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="radio"
          class="chip"
          [class.selected]="value() === option.value"
          [attr.aria-checked]="value() === option.value"
          [disabled]="disabled()"
          (click)="value.set(option.value)"
        >
          @if (option.emoji) {
            <span aria-hidden="true">{{ option.emoji }}</span>
          }
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 12px; border-radius: 999px; font: inherit; font-size: 14px;
      color: var(--ion-text-color); background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .chip.selected {
      border-color: var(--ion-color-primary);
      background: rgba(var(--ion-color-primary-rgb), 0.1);
      color: var(--ion-color-primary);
      font-weight: 600;
    }
    .invalid .chip { border-color: rgba(var(--ion-color-danger-rgb), 0.5); }
  `,
})
export class ChipPickerComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly options = input.required<readonly ChipOption[]>();
  readonly label = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly touched = input(false);
}
