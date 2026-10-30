import { Component, computed, inject, input } from '@angular/core';
import { CategoriesStore } from '../categories/categories-store';
import { TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe, formatMoney } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import type { BudgetProgress } from './budget.model';

const MAX_CHIPS = 4;

@Component({
  selector: 'app-budget-card',
  imports: [MoneyPipe, TranslatePipe],
  host: { '[class]': "'status-' + progress().status", '[class.compact]': 'compact()' },
  template: `
    <div class="top">
      <span class="name">{{ progress().budget.name }}</span>
      <span class="badge">{{ progress().status === 'over' ? ('overBadge' | t) : percent() }}</span>
    </div>
    <div class="amounts">
      <span class="spent">{{ progress().spent | money }}</span>
      <span class="of">{{ 'budgetOf' | t: limit() }}</span>
    </div>
    <div class="bar" role="progressbar" [attr.aria-valuenow]="clamped()" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="progress().budget.name">
      <span [style.width.%]="clamped()"></span>
    </div>
    <span class="left">
      {{ progress().remaining >= 0 ? ('budgetLeft' | t: remaining()) : ('budgetOver' | t: remaining()) }}
    </span>
    @if (!compact()) {
      <div class="chips">
        @for (name of chips(); track name) {
          <span class="chip" [title]="name">{{ categories.info(name).emoji }}</span>
        }
        @if (extra()) {
          <span class="chip more">+{{ extra() }}</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      --tone: var(--ion-color-primary);
      display: flex; flex-direction: column; gap: 8px; padding: 18px; border-radius: 18px;
      border: 1px solid var(--wl-field-border); background: var(--ion-background-color);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    :host(.status-warning) { --tone: #d97706; }
    :host(.status-over) { --tone: #dc2626; }
    :host(.compact) { padding: 0; border: 0; gap: 6px; background: transparent; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .name { font-weight: 700; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    :host(.compact) .name { font-size: 14px; font-weight: 600; }
    .badge { flex: none; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--tone); background: color-mix(in srgb, var(--tone) 13%, transparent); }
    .amounts { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
    .spent { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
    :host(.compact) .amounts { display: none; }
    .of { font-size: 13px; color: var(--wl-muted); }
    .bar { height: 8px; border-radius: 999px; background: var(--wl-field-bg); overflow: hidden; }
    :host(.compact) .bar { height: 6px; }
    .bar span { display: block; height: 100%; border-radius: inherit; background: var(--tone); transition: width 0.3s ease; }
    .left { font-size: 13px; font-weight: 600; color: var(--tone); }
    :host(.status-ok) .left { color: var(--wl-muted); font-weight: 500; }
    .chips { display: flex; gap: 6px; margin-top: 2px; }
    .chip { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; font-size: 14px; background: var(--wl-field-bg); }
    .chip.more { width: auto; padding: 0 8px; font-size: 12px; font-weight: 600; color: var(--wl-muted); }
  `,
})
export class BudgetCardComponent {
  readonly categories = inject(CategoriesStore);
  private readonly preferences = inject(PreferencesStore);

  readonly progress = input.required<BudgetProgress>();
  readonly compact = input(false);

  readonly clamped = computed(() => Math.min(100, Math.round(this.progress().percent)));
  readonly percent = computed(() => `${Math.round(this.progress().percent)}%`);
  readonly limit = computed(() => formatMoney(this.progress().limit, this.preferences.currency()));
  readonly remaining = computed(() => formatMoney(Math.abs(this.progress().remaining), this.preferences.currency()));
  readonly chips = computed(() => this.progress().budget.categories.slice(0, MAX_CHIPS));
  readonly extra = computed(() => Math.max(0, this.progress().budget.categories.length - MAX_CHIPS));
}
