import { Service, computed, inject, resource } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { Supabase } from '../core/supabase';
import { monthRange } from '../core/dates';
import { MovementsStore } from './movements-store';

export interface MonthPoint {
  key: string;
  label: string;
  gastos: number;
  ingresos: number;
  isCurrent: boolean;
}

export interface ExpenseChange {
  percent: number;
  previousMonth: string;
}

const MONTHS_BACK = 5;

function monthKey(offset: number): string {
  return monthRange(offset).from.slice(0, 7);
}

function shortMonth(offset: number): string {
  const from = monthRange(offset).from;
  const [y, m] = from.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
}

@Service()
export class InsightsStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly movements = inject(MovementsStore);

  private readonly history = resource({
    params: () => {
      const userId = this.auth.user()?.id;
      if (!userId) return undefined;
      const offset = this.movements.monthOffset();
      return { userId, from: monthRange(offset - MONTHS_BACK).from, to: monthRange(offset - 1).to };
    },
    loader: async ({ params }) => {
      const { data, error } = await this.supabase
        .from('expenses')
        .select('date, amount, tipo')
        .eq('user_id', params.userId)
        .is('group_id', null)
        .gte('date', params.from)
        .lte('date', params.to);
      if (error) throw error;
      return data;
    },
  });

  readonly months = computed<MonthPoint[]>(() => {
    const offset = this.movements.monthOffset();
    const rows = this.history.hasValue() ? this.history.value() : [];
    const points: MonthPoint[] = [];
    for (let i = offset - MONTHS_BACK; i < offset; i++) {
      const key = monthKey(i);
      const inMonth = rows.filter((r) => r.date.startsWith(key));
      const sum = (tipo: string) => inMonth.filter((r) => r.tipo === tipo).reduce((s, r) => s + Number(r.amount), 0);
      points.push({ key, label: shortMonth(i), gastos: sum('gasto'), ingresos: sum('ingreso'), isCurrent: false });
    }
    const current = this.movements.summary();
    points.push({ key: monthKey(offset), label: shortMonth(offset), gastos: current.gastos, ingresos: current.ingresos, isCurrent: true });
    return points;
  });

  readonly expenseChange = computed<ExpenseChange | null>(() => {
    if (!this.history.hasValue()) return null;
    const points = this.months();
    const previous = points[points.length - 2];
    const current = points[points.length - 1];
    if (!previous.gastos) return null;
    const label = monthRange(this.movements.monthOffset() - 1).label.split(' ')[0].toLowerCase();
    return { percent: ((current.gastos - previous.gastos) / previous.gastos) * 100, previousMonth: label };
  });

  reload(): void {
    this.history.reload();
  }
}
