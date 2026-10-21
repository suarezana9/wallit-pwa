import { Component, computed, inject, input, model, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { CATEGORIES, CategoryInfo } from './movement.model';

const COLLAPSED = 11;

@Component({
  selector: 'app-category-picker',
  imports: [IonIcon, TranslatePipe],
  template: `
    <div class="grid" role="radiogroup" [attr.aria-label]="label()" [class.invalid]="invalid() && touched()">
      @for (category of visible(); track category.name) {
        <button
          type="button"
          role="radio"
          class="tile"
          [class.selected]="value() === category.name"
          [attr.aria-checked]="value() === category.name"
          [disabled]="disabled()"
          [style.--cat-color]="category.color"
          [title]="names()[category.name]"
          (click)="value.set(category.name)"
        >
          <span class="icon" aria-hidden="true">{{ category.emoji }}</span>
          <span class="name">{{ names()[category.name] }}</span>
        </button>
      }
      <button type="button" class="tile more" [attr.aria-expanded]="expanded()" (click)="expanded.set(!expanded())">
        <span class="icon" aria-hidden="true"><ion-icon [name]="expanded() ? 'chevron-up-outline' : 'chevron-down-outline'" /></span>
        <span class="name">{{ (expanded() ? 'lessCategories' : 'moreCategories') | t }}</span>
      </button>
    </div>
  `,
  styles: `
    :host { display: block; container-type: inline-size; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
    @container (min-width: 440px) { .grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
    .tile {
      display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 0;
      padding: 8px 1px 7px; border-radius: 12px; font: inherit; color: var(--ion-text-color);
      background: transparent; border: 1px solid transparent; cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .tile:hover:not(:disabled) { background: var(--wl-field-bg); }
    .icon {
      display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; font-size: 19px;
      background: color-mix(in srgb, var(--cat-color, var(--wl-muted)) 14%, transparent);
    }
    .name {
      max-width: 100%; font-size: 11.5px; line-height: 1.2; letter-spacing: -0.01em; color: var(--wl-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .tile.selected {
      border-color: var(--ion-color-primary);
      background: rgba(var(--ion-color-primary-rgb), 0.08);
    }
    .tile.selected .name { color: var(--ion-color-primary); font-weight: 600; }
    .more .icon { background: var(--wl-field-bg); color: var(--wl-muted); font-size: 18px; }
    .invalid .icon { box-shadow: 0 0 0 1px rgba(var(--ion-color-danger-rgb), 0.5); }
  `,
})
export class CategoryPickerComponent implements FormValueControl<string> {
  private readonly i18n = inject(I18n);

  readonly value = model('');
  readonly label = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly expanded = signal(false);

  readonly names = computed(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.name, this.i18n.category(c.name)])) as Record<string, string>,
  );

  readonly visible = computed<readonly CategoryInfo[]>(() => {
    if (this.expanded()) return CATEGORIES;
    const first = CATEGORIES.slice(0, COLLAPSED);
    const selected = CATEGORIES.find((c) => c.name === this.value());
    if (!selected || first.includes(selected)) return first;
    return [...first.slice(0, COLLAPSED - 1), selected];
  });

  constructor() {
    addIcons({ chevronDownOutline, chevronUpOutline });
  }
}
