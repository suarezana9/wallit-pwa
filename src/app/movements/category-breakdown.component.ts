import { Component, computed, inject, input } from '@angular/core';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import type { Movimiento } from '../core/database.types';
import { categoryInfo } from './movement.model';

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
    @for (row of rows(); track row.name) {
      <div class="row">
        <div class="row-head">
          <span class="name"><span aria-hidden="true">{{ row.emoji }}</span> {{ row.label }}</span>
          <span class="amount">{{ row.total | money }}</span>
        </div>
        <div class="bar" role="progressbar" [attr.aria-valuenow]="row.percent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="row.label">
          <span [style.width.%]="row.percent" [style.background]="row.color"></span>
        </div>
      </div>
    } @empty {
      <p class="empty">{{ 'noExpensesMonth' | t }}</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .row-head { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; font-size: 14px; }
    .name { font-weight: 600; }
    .amount { font-variant-numeric: tabular-nums; color: var(--wl-muted); }
    .bar { height: 6px; border-radius: 999px; background: var(--wl-field-bg); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: inherit; }
    .empty { margin: 0; color: var(--wl-muted); font-size: 14px; }
  `,
})
export class CategoryBreakdownComponent {
  readonly movements = input.required<readonly Movimiento[]>();
  readonly limit = input(6);
  private readonly i18n = inject(I18n);

  readonly rows = computed<CategoryRow[]>(() => {
    const totals = new Map<string, number>();
    for (const m of this.movements()) {
      if (m.tipo !== 'gasto') continue;
      totals.set(m.category, (totals.get(m.category) ?? 0) + Number(m.amount));
    }
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.limit())
      .map(([name, total]) => {
        const info = categoryInfo(name);
        return { name, label: this.i18n.category(name), emoji: info.emoji, color: info.color, total, percent: sum ? Math.round((total / sum) * 100) : 0 };
      });
  });
}
