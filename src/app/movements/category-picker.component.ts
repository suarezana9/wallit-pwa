import { Component, ElementRef, computed, inject, input, linkedSignal, model, signal, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, chevronUpOutline, closeCircle, ellipsisHorizontal, searchOutline } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { CategoriesStore } from '../categories/categories-store';
import { EMOJI_CHOICES, filterCategories, findExact, suggestEmoji } from '../categories/category-config';
import { CategoryInfo } from './movement.model';

const COLLAPSED = 11;

/**
 * Selector de categoría del formulario. "Más" abre todas con un buscador que también crea:
 * si escribís algo que no existe, aparece "Crear …" con un emoji sugerido, sin salir del formulario.
 */
@Component({
  selector: 'app-category-picker',
  imports: [IonIcon, IonSpinner, TranslatePipe],
  template: `
    @if (expanded()) {
      <div class="search">
        <ion-icon name="search-outline" aria-hidden="true" />
        <input
          #searchInput
          type="text"
          maxlength="30"
          autocomplete="off"
          [placeholder]="'categorySearchOrCreate' | t"
          [attr.aria-label]="'categorySearchOrCreate' | t"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          (keydown.enter)="onEnter($event)"
          (keydown.escape)="collapse()"
        />
        @if (query()) {
          <button type="button" class="clear" (click)="query.set('')" [attr.aria-label]="'clear' | t">
            <ion-icon name="close-circle" />
          </button>
        }
      </div>
    }

    <div class="grid" role="radiogroup" [attr.aria-label]="label()" [class.invalid]="invalid() && touched()">
      @for (category of shown(); track category.name) {
        <button
          type="button"
          role="radio"
          class="tile"
          [class.selected]="value() === category.name"
          [attr.aria-checked]="value() === category.name"
          [disabled]="disabled()"
          [style.--cat-color]="category.color"
          [title]="names()[category.name]"
          (click)="pick(category.name)"
        >
          <span class="icon" aria-hidden="true">{{ category.emoji }}</span>
          <span class="name">{{ names()[category.name] }}</span>
        </button>
      }

      @if (!expanded()) {
        <button type="button" class="tile more" [attr.aria-expanded]="false" (click)="expand()">
          <span class="icon" aria-hidden="true"><ion-icon [name]="hasMore() ? 'ellipsis-horizontal' : 'add'" /></span>
          <span class="name">{{ (hasMore() ? 'moreCategories' : 'newCategoryShort') | t }}</span>
        </button>
      } @else if (!canCreate()) {
        <button type="button" class="tile more" [attr.aria-expanded]="true" (click)="collapse()">
          <span class="icon" aria-hidden="true"><ion-icon name="chevron-up-outline" /></span>
          <span class="name">{{ 'lessCategories' | t }}</span>
        </button>
      }
    </div>

    @if (expanded()) {
      @if (canCreate()) {
        <div class="create">
          <button type="button" class="create-main" [disabled]="creating()" (click)="create()">
            <span class="icon new" aria-hidden="true">{{ emoji() }}</span>
            <span class="create-text">
              <strong>{{ 'createCategoryNamed' | t: query().trim() }}</strong>
              <span>{{ 'createCategoryHint' | t }}</span>
            </span>
            @if (creating()) {
              <ion-spinner name="crescent" />
            } @else {
              <ion-icon name="add" class="plus" aria-hidden="true" />
            }
          </button>
          <div class="emojis" role="radiogroup" [attr.aria-label]="'categoryEmoji' | t">
            @for (option of emojiOptions(); track option) {
              <button
                type="button"
                role="radio"
                [class.selected]="emoji() === option"
                [attr.aria-checked]="emoji() === option"
                (click)="emoji.set(option)"
              >{{ option }}</button>
            }
          </div>
        </div>
      } @else if (query() && !shown().length) {
        <p class="empty">{{ 'categoryNoMatch' | t }}</p>
      } @else if (!query()) {
        <p class="tip">{{ 'categoryCreateTip' | t }}</p>
      }
    }
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
    .tile.selected { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.08); }
    .tile.selected .name { color: var(--ion-color-primary); font-weight: 600; }
    .more .icon { background: var(--wl-field-bg); color: var(--wl-muted); font-size: 18px; }
    .invalid .icon { box-shadow: 0 0 0 1px rgba(var(--ion-color-danger-rgb), 0.5); }
    .search {
      display: flex; align-items: center; gap: 8px; height: 44px; margin-bottom: 8px; padding: 0 10px 0 12px;
      border-radius: 12px; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
    }
    .search:focus-within { border-color: var(--ion-color-primary); box-shadow: 0 0 0 4px rgba(var(--ion-color-primary-rgb), 0.12); }
    .search ion-icon { flex: none; color: var(--wl-muted); font-size: 18px; }
    .search input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font: inherit; font-size: 15px; color: inherit; }
    .clear { display: grid; place-items: center; padding: 0; border: 0; background: none; color: var(--wl-muted); font-size: 18px; cursor: pointer; }
    .create { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
    .create-main {
      display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border-radius: 14px;
      font: inherit; text-align: left; color: inherit; cursor: pointer;
      background: rgba(var(--ion-color-primary-rgb), 0.08); border: 1px dashed rgba(var(--ion-color-primary-rgb), 0.5);
    }
    .create-main:hover:not(:disabled) { background: rgba(var(--ion-color-primary-rgb), 0.13); }
    .icon.new { flex: none; background: var(--ion-background-color, #fff); }
    .create-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .create-text strong { font-size: 14px; color: var(--ion-color-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .create-text span { font-size: 12px; color: var(--wl-muted); }
    .plus { flex: none; font-size: 22px; color: var(--ion-color-primary); }
    .emojis { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
    .emojis::-webkit-scrollbar { display: none; }
    .emojis button {
      flex: none; width: 36px; height: 36px; border-radius: 10px; font-size: 18px; cursor: pointer;
      background: var(--wl-field-bg); border: 1px solid transparent;
    }
    .emojis button.selected { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.1); }
    .empty, .tip { margin: 8px 2px 0; font-size: 12px; color: var(--wl-muted); }
  `,
})
export class CategoryPickerComponent implements FormValueControl<string> {
  private readonly i18n = inject(I18n);
  private readonly categories = inject(CategoriesStore);
  private readonly toasts = inject(ToastController);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly value = model('');
  readonly label = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly expanded = signal(false);
  readonly query = signal('');
  readonly creating = signal(false);
  readonly emoji = linkedSignal(() => suggestEmoji(this.query()));

  private readonly options = computed<readonly CategoryInfo[]>(() => {
    const list = this.categories.visible();
    const value = this.value();
    if (!value || list.some((c) => c.name === value)) return list;
    return [...list, this.categories.info(value)];
  });

  /** Al buscar también aparecen las predeterminadas ocultas, por si querés volver a usar una. */
  private readonly searchable = computed(() => [...this.options(), ...this.categories.hiddenBuiltins()]);

  readonly names = computed(() =>
    Object.fromEntries(this.searchable().map((c) => [c.name, this.i18n.category(c.name)])) as Record<string, string>,
  );

  readonly hasMore = computed(() => this.options().length > COLLAPSED + 1);

  readonly shown = computed<readonly CategoryInfo[]>(() => {
    if (this.expanded()) {
      const query = this.query();
      return query ? filterCategories(this.searchable(), query, (n) => this.i18n.category(n)) : this.options();
    }
    const all = this.options();
    if (!this.hasMore()) return all;
    const first = all.slice(0, COLLAPSED);
    const selected = all.find((c) => c.name === this.value());
    if (!selected || first.includes(selected)) return first;
    return [...first.slice(0, COLLAPSED - 1), selected];
  });

  private readonly exact = computed(() => findExact(this.searchable(), this.query()));
  readonly canCreate = computed(() => this.query().trim().length > 0 && !this.exact());

  readonly emojiOptions = computed(() => {
    const suggested = suggestEmoji(this.query());
    return [suggested, ...EMOJI_CHOICES.filter((e) => e !== suggested)];
  });

  constructor() {
    addIcons({ add, chevronUpOutline, closeCircle, ellipsisHorizontal, searchOutline });
  }

  expand(): void {
    this.expanded.set(true);
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  collapse(): void {
    this.expanded.set(false);
    this.query.set('');
  }

  async pick(name: string): Promise<void> {
    this.value.set(name);
    if (this.categories.hidden().has(name)) await this.categories.unhide(name);
    if (this.expanded() && this.query()) this.collapse();
  }

  async onEnter(event: Event): Promise<void> {
    event.preventDefault();
    const exact = this.exact();
    if (exact) await this.pick(exact.name);
    else if (this.canCreate()) await this.create();
  }

  async create(): Promise<void> {
    const name = this.query().trim();
    if (!name || this.creating()) return;
    this.creating.set(true);
    const saved = await this.categories.quickCreate(name, this.emoji());
    this.creating.set(false);
    if (!saved) {
      await this.toast(this.i18n.t('errCategoryCreate'), 'danger');
      return;
    }
    this.value.set(saved);
    this.collapse();
    await this.toast(this.i18n.t('categoryCreated', saved), 'dark');
  }

  private async toast(message: string, color: 'dark' | 'danger'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 1800, position: 'top' });
    await toast.present();
  }
}
