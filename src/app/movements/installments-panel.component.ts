import { Component, computed, inject, input, resource } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { monthRange } from '../core/dates';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import { Supabase } from '../core/supabase';
import { CategoriesStore } from '../categories/categories-store';
import { futurePurchases } from './installments.model';

/** "Cuotas a futuro": lo que ya comprometiste de los meses que vienen, compra por compra. */
@Component({
  selector: 'app-installments-panel',
  imports: [MoneyPipe, TranslatePipe],
  template: `
    @if (purchases().length) {
      <section class="wl-panel" aria-labelledby="installments-title">
        <h2 id="installments-title">{{ 'futureInstallments' | t }}</h2>
        <div class="totals">
          <div>
            <span>{{ 'installmentsNextMonth' | t }}</span>
            <strong>{{ nextMonth() | money }}</strong>
          </div>
          <div>
            <span>{{ 'totalPending' | t }}</span>
            <strong>{{ total() | money }}</strong>
          </div>
        </div>
        <ul>
          @for (p of purchases(); track p.compraId) {
            <li>
              <span class="emoji" aria-hidden="true">{{ emoji(p.category) }}</span>
              <span class="body">
                <span class="row">
                  <span class="name">{{ p.description || category(p.category) }}</span>
                  <span class="amount">{{ p.installment | money }}</span>
                </span>
                <span class="bar" aria-hidden="true"><span [style.width.%]="(p.paidCount / p.total) * 100"></span></span>
                <span class="meta">{{ 'installmentsLeft' | t: '' + p.paidCount : '' + p.total : '' + p.remainingCount }}</span>
              </span>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    h2 { margin: 0 0 12px; font-size: 16px; font-weight: 700; }
    .totals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
    .totals div { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: var(--wl-field-bg); }
    .totals span { font-size: 12px; color: var(--wl-muted); }
    .totals strong { font-size: 16px; font-variant-numeric: tabular-nums; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
    .emoji { flex: none; font-size: 18px; }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; font-weight: 600; }
    .name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .amount { flex: none; font-variant-numeric: tabular-nums; }
    .bar { height: 5px; border-radius: 999px; background: var(--wl-field-bg); overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--ion-color-primary); }
    .meta { font-size: 12px; color: var(--wl-muted); }
  `,
})
export class InstallmentsPanelComponent {
  readonly groupId = input<string | null>(null);

  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18n);
  private readonly categories = inject(CategoriesStore);
  readonly preferences = inject(PreferencesStore);

  /** Fin del mes actual: lo que viene después es "a futuro". */
  private readonly monthEnd = monthRange(0).to;

  readonly data = resource({
    params: () => {
      const userId = this.auth.user()?.id;
      return userId ? { userId, groupId: this.groupId() } : undefined;
    },
    loader: async ({ params }) => {
      const base = this.supabase
        .from('expenses')
        .select('compra_id, amount, date, description, category, cuota_num, cuotas_total')
        .not('compra_id', 'is', null)
        .gt('date', this.monthEnd);
      const { data, error } = await (params.groupId ? base.eq('group_id', params.groupId) : base.eq('user_id', params.userId).is('group_id', null));
      return error ? [] : data;
    },
  });

  readonly purchases = computed(() => futurePurchases(this.data.hasValue() ? this.data.value() : [], this.monthEnd));
  readonly total = computed(() => this.purchases().reduce((s, p) => s + p.remaining, 0));
  readonly nextMonth = computed(() => {
    const next = monthRange(1);
    const rows = this.data.hasValue() ? this.data.value() : [];
    return rows.filter((r) => r.date >= next.from && r.date <= next.to).reduce((s, r) => s + Number(r.amount), 0);
  });

  reload(): void {
    this.data.reload();
  }

  emoji(category: string): string {
    return this.categories.info(category).emoji;
  }

  category(name: string): string {
    return this.i18n.category(name);
  }
}
