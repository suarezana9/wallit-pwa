import { Component, computed, inject, input, model } from '@angular/core';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import type { CategoryInfo } from '../movements/movement.model';
import { CategoriesStore } from './categories-store';

@Component({
  selector: 'app-category-multi-picker',
  imports: [TranslatePipe],
  template: `
    <div class="head">
      <span class="count">{{ 'selectedCount' | t: '' + value().length }}</span>
      <button type="button" class="toggle-all" (click)="toggleAll()">
        {{ (allSelected() ? 'clearAll' : 'selectAll') | t }}
      </button>
    </div>
    <div class="grid" role="group" [attr.aria-label]="label()" [class.invalid]="invalid()">
      @for (category of options(); track category.name) {
        <button
          type="button"
          class="tile"
          [class.selected]="selected().has(category.name)"
          [attr.aria-pressed]="selected().has(category.name)"
          [style.--cat-color]="category.color"
          [title]="names()[category.name]"
          (click)="toggle(category.name)"
        >
          <span class="icon" aria-hidden="true">{{ category.emoji }}</span>
          <span class="name">{{ names()[category.name] }}</span>
          <span class="check" aria-hidden="true">✓</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; container-type: inline-size; }
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; }
    .count { color: var(--wl-muted); }
    .toggle-all { padding: 0; font: inherit; font-weight: 600; color: var(--ion-color-primary); background: none; border: 0; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
    @container (min-width: 440px) { .grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
    .tile {
      position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 0;
      padding: 8px 1px 7px; border-radius: 12px; font: inherit; color: var(--ion-text-color);
      background: transparent; border: 1px solid transparent; cursor: pointer;
    }
    .tile:hover { background: var(--wl-field-bg); }
    .icon {
      display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; font-size: 19px;
      background: color-mix(in srgb, var(--cat-color) 14%, transparent); opacity: 0.55; filter: grayscale(0.6);
      transition: opacity 0.15s ease, filter 0.15s ease;
    }
    .name { max-width: 100%; font-size: 11.5px; color: var(--wl-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .check {
      position: absolute; top: 4px; right: 8px; width: 16px; height: 16px; border-radius: 50%; display: none;
      place-items: center; font-size: 10px; font-weight: 700; color: #fff; background: var(--ion-color-primary);
    }
    .tile.selected { border-color: rgba(var(--ion-color-primary-rgb), 0.45); background: rgba(var(--ion-color-primary-rgb), 0.06); }
    .tile.selected .icon { opacity: 1; filter: none; }
    .tile.selected .name { color: var(--ion-text-color); font-weight: 600; }
    .tile.selected .check { display: grid; }
    .invalid .tile { border-color: rgba(var(--ion-color-danger-rgb), 0.3); }
  `,
})
export class CategoryMultiPickerComponent {
  private readonly categories = inject(CategoriesStore);
  private readonly i18n = inject(I18n);

  readonly value = model<string[]>([]);
  readonly label = input('');
  readonly invalid = input(false);

  readonly selected = computed(() => new Set(this.value()));

  readonly options = computed<CategoryInfo[]>(() => {
    const visible = this.categories.visible();
    const extra = this.value().filter((name) => !visible.some((c) => c.name === name));
    return [...visible, ...extra.map((name) => this.categories.info(name))];
  });

  readonly names = computed(
    () => Object.fromEntries(this.options().map((c) => [c.name, this.i18n.category(c.name)])) as Record<string, string>,
  );

  readonly allSelected = computed(() => this.options().every((c) => this.selected().has(c.name)));

  toggle(name: string): void {
    this.value.update((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]));
  }

  toggleAll(): void {
    this.value.set(this.allSelected() ? [] : this.options().map((c) => c.name));
  }
}
