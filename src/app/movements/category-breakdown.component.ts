import { Component, computed, inject, input, output, signal } from '@angular/core';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import type { Movimiento } from '../core/database.types';
import { CategoriesStore } from '../categories/categories-store';

interface CategoryRow {
  name: string;
  label: string;
  emoji: string;
  color: string;
  total: number;
  percent: number;
}

@Component({
  selector: 'app-category-breakdown',
  imports: [MoneyPipe, TranslatePipe],
  template: `
    @for (row of visible(); track row.name) {
      <button type="button" class="row" [class.active]="row.name === selectedName()" (click)="selected.emit(row.name)" [attr.aria-label]="row.label + ' ' + (row.total | money)">
        <span class="row-head">
          <span class="name"><span aria-hidden="true">{{ row.emoji }}</span> {{ row.label }}</span>
          <span class="amount">{{ row.total | money }} <span class="pct">{{ row.percent }}%</span></span>
        </span>
        <span class="bar" aria-hidden="true">
          <span [style.width.%]="row.percent" [style.background]="row.color"></span>
        </span>
      </button>
    } @empty {
      <p class="empty">{{ 'noExpensesMonth' | t }}</p>
    }
    @if (hidden() > 0 || expanded()) {
      <button type="button" class="more" [attr.aria-expanded]="expanded()" (click)="expanded.set(!expanded())">
        {{ expanded() ? ('showLess' | t) : ('showAllCategories' | t: '' + rows().length) }}
      </button>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 6px; }
    .row {
      display: flex; flex-direction: column; gap: 6px; width: calc(100% + 16px); margin: 0 -8px; padding: 7px 8px;
      border-radius: 10px; border: 0; background: none; font: inherit; text-align: left; color: inherit; cursor: pointer;
    }
    .row:hover { background: var(--wl-field-bg); }
    .row.active { background: rgba(var(--ion-color-primary-rgb), 0.08); }
    .row-head { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
    .name { min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .amount { flex: none; font-variant-numeric: tabular-nums; color: var(--wl-muted); }
    .pct { display: inline-block; min-width: 3.2ch; margin-left: 4px; font-size: 12px; text-align: right; opacity: 0.8; }
    .bar { display: block; height: 6px; border-radius: 999px; background: var(--wl-field-bg); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: inherit; }
    .empty { margin: 0; color: var(--wl-muted); font-size: 14px; }
    .more {
      align-self: flex-start; margin-top: 4px; padding: 6px 0; border: 0; background: none;
      font: inherit; font-size: 13px; font-weight: 600; color: var(--ion-color-primary); cursor: pointer;
    }
  `,
})
export class CategoryBreakdownComponent {
  readonly movements = input.required<readonly Movimiento[]>();
  /** Cuántas se ven antes de "Ver las N categorías". */
  readonly limit = input(6);
  /** Categoría resaltada (la del filtro activo). */
  readonly selectedName = input<string | null>(null);
  /** Tocar una categoría: en Inicio lleva a sus movimientos, en Movimientos filtra. */
  readonly selected = output<string>();
  readonly expanded = signal(false);
  private readonly i18n = inject(I18n);
  private readonly categories = inject(CategoriesStore);

  readonly rows = computed<CategoryRow[]>(() => {
    const totals = new Map<string, number>();
    for (const m of this.movements()) {
      if (m.tipo !== 'gasto') continue;
      totals.set(m.category, (totals.get(m.category) ?? 0) + Number(m.amount));
    }
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => {
        const info = this.categories.info(name);
        return { name, label: this.i18n.category(name), emoji: info.emoji, color: info.color, total, percent: sum ? Math.round((total / sum) * 100) : 0 };
      });
  });

  readonly visible = computed(() => (this.expanded() ? this.rows() : this.rows().slice(0, this.limit())));
  readonly hidden = computed(() => this.rows().length - this.visible().length);
}
