import { Component, inject, input, model } from '@angular/core';
import { I18n, TranslatePipe, TranslationKey } from '../core/i18n/i18n';
import { EMOJI_GROUPS } from './category-config';

const GROUP_LABELS: Record<string, TranslationKey> = {
  home: 'emojiGroupHome',
  food: 'emojiGroupFood',
  transport: 'emojiGroupTransport',
  health: 'emojiGroupHealth',
  fun: 'emojiGroupFun',
  shopping: 'emojiGroupShopping',
  money: 'emojiGroupMoney',
  family: 'emojiGroupFamily',
  work: 'emojiGroupWork',
};

/**
 * Todos los íconos para categorías, agrupados por tema y con scroll propio (son más de 150).
 * Uso: <app-emoji-grid [(value)]="emoji" />
 */
@Component({
  selector: 'app-emoji-grid',
  imports: [TranslatePipe],
  template: `
    <div class="scroll" role="radiogroup" [attr.aria-label]="'icon' | t" [style.max-height.px]="maxHeight()">
      @for (group of groups; track group.id) {
        <p class="label">{{ label(group.id) }}</p>
        <div class="grid">
          @for (item of group.emojis; track item) {
            <button
              type="button"
              role="radio"
              [class.selected]="value() === item"
              [attr.aria-checked]="value() === item"
              (click)="value.set(item)"
            >{{ item }}</button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .scroll {
      overflow-y: auto; overscroll-behavior: contain; padding: 4px 8px 8px; border-radius: 14px;
      background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
    }
    .label {
      position: sticky; top: -4px; z-index: 1; margin: 0; padding: 8px 2px 4px; font-size: 12px; font-weight: 700;
      letter-spacing: 0.04em; text-transform: uppercase; color: var(--wl-muted); background: var(--wl-field-bg);
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 2px; }
    button {
      aspect-ratio: 1; padding: 0; border-radius: 10px; font-size: 21px; line-height: 1; cursor: pointer;
      background: transparent; border: 1px solid transparent;
    }
    button:hover { background: var(--wl-surface); }
    button.selected { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.12); }
  `,
})
export class EmojiGridComponent {
  private readonly i18n = inject(I18n);
  readonly value = model<string>('🏷️');
  readonly maxHeight = input(260);
  readonly groups = EMOJI_GROUPS;

  label(id: string): string {
    return this.i18n.t(GROUP_LABELS[id] ?? 'icon');
  }
}
