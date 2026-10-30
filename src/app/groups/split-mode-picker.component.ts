import { Component, model } from '@angular/core';
import { TranslatePipe, TranslationKey } from '../core/i18n/i18n';

/** "¿Cómo manejan la plata?": bolsa común (no se llevan cuentas) o dividen gastos (saldos y deudas). */
@Component({
  selector: 'app-split-mode-picker',
  imports: [TranslatePipe],
  template: `
    <div class="options" role="radiogroup" [attr.aria-label]="'splitModeTitle' | t">
      @for (option of options; track option.value) {
        <button
          type="button"
          role="radio"
          class="option"
          [class.selected]="value() === option.value"
          [attr.aria-checked]="value() === option.value"
          (click)="value.set(option.value)"
        >
          <span class="emoji" aria-hidden="true">{{ option.emoji }}</span>
          <span class="text">
            <span class="title">{{ option.title | t }}</span>
            <span class="hint">{{ option.hint | t }}</span>
          </span>
          <span class="radio" aria-hidden="true"></span>
        </button>
      }
    </div>
  `,
  styles: `
    .options { display: flex; flex-direction: column; gap: 8px; }
    .option {
      display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px; border-radius: 14px;
      font: inherit; text-align: left; color: inherit; cursor: pointer;
      background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
    }
    .option.selected { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.08); }
    .emoji { flex: none; font-size: 22px; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .title { font-size: 14px; font-weight: 700; }
    .hint { font-size: 12px; line-height: 1.35; color: var(--wl-muted); }
    .radio { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--wl-field-border); }
    .selected .radio { border: 5px solid var(--ion-color-primary); }
  `,
})
export class SplitModePickerComponent {
  /** true = dividen gastos. */
  readonly value = model.required<boolean>();

  readonly options: { value: boolean; emoji: string; title: TranslationKey; hint: TranslationKey }[] = [
    { value: false, emoji: '🫙', title: 'splitModeShared', hint: 'splitModeSharedHint' },
    { value: true, emoji: '🧮', title: 'splitModeSplit', hint: 'splitModeSplitHint' },
  ];
}
