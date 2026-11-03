import { Service, computed, inject, resource } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { Supabase } from '../core/supabase';
import { monthName, monthRange } from '../core/dates';
import { PreferencesStore } from '../core/preferences-store';
import { GroupsStore } from '../groups/groups-store';
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

/** Gastos del mes en tramos de 7 días: 1–7, 8–14, 15–21, 22–28 y 29 al último (si existe). */
export function weeksOf(monthStart: string, list: readonly { tipo: string; amount: number; date: string }[], today = new Date()): MonthPoint[] {
  const [y, m] = monthStart.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const isThisMonth = monthStart.startsWith(todayKey);
  const points: MonthPoint[] = [];
  for (let from = 1; from <= last; from += 7) {
    const to = Math.min(from + 6, last);
    const gastos = list
      .filter((mv) => mv.tipo === 'gasto')
      .filter((mv) => {
        const d = Number(mv.date.slice(8, 10));
        return mv.date.startsWith(monthStart.slice(0, 7)) && d >= from && d <= to;
      })
      .reduce((sum, mv) => sum + Number(mv.amount), 0);
    const day = today.getDate();
    points.push({ key: `w${from}`, label: from === to ? `${from}` : `${from}–${to}`, gastos, ingresos: 0, isCurrent: isThisMonth && day >= from && day <= to });
  }
  return points;
}

function monthKey(offset: number): string {
  return monthRange(offset).from.slice(0, 7);
}


@Service()
export class InsightsStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly movements = inject(MovementsStore);
  private readonly preferences = inject(PreferencesStore);
  private readonly groups = inject(GroupsStore);

  private readonly history = resource({
    params: () => {
      const userId = this.auth.user()?.id;
      if (!userId) return undefined;
      const offset = this.movements.monthOffset();
      return {
        userId,
        groupId: this.groups.activeGroupId(),
        from: monthRange(offset - MONTHS_BACK).from,
        to: monthRange(offset - 1).to,
      };
    },
    loader: async ({ params }) => {
      const base = this.supabase.from('expenses').select('date, amount, tipo');
      const scoped = params.groupId
        ? base.eq('group_id', params.groupId)
        : base.eq('user_id', params.userId).is('group_id', null);
      const { data, error } = await scoped
        .gte('date', params.from)
        .lte('date', params.to);
      if (error) throw error;
      return data;
    },
  });

  readonly months = computed<MonthPoint[]>(() => {
    const offset = this.movements.monthOffset();
    const locale = this.preferences.locale();
    const shortMonth = (o: number) => monthName(o, locale, 'short');
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

  /**
   * Lo que muestra "Evolución de gastos":
   * - con 2 meses o más con gastos: un mes por barra, desde el primero con datos (hasta 6);
   * - si solo hay datos del mes que estás viendo: ese mes por semana (1–7, 8–14…), así no quedan 5 meses vacíos.
   */
  readonly trend = computed<{ mode: 'months' | 'weeks'; points: MonthPoint[] }>(() => {
    const months = this.months();
    const first = months.findIndex((p) => p.gastos > 0);
    const fromFirst = first < 0 ? [] : months.slice(first);
    if (fromFirst.length >= 2) return { mode: 'months', points: fromFirst };
    return { mode: 'weeks', points: weeksOf(this.movements.range().from, this.movements.list()) };
  });

  /**
   * ¿Hay gastos en los meses anteriores al que estás viendo? null mientras carga.
   * Sin historial el gráfico de evolución queda vacío y en Inicio se muestran los primeros pasos.
   */
  readonly hasHistory = computed<boolean | null>(() => {
    if (!this.history.hasValue()) return null;
    return this.months().some((p) => !p.isCurrent && p.gastos > 0);
  });

  readonly expenseChange = computed<ExpenseChange | null>(() => {
    if (!this.history.hasValue()) return null;
    const points = this.months();
    const previous = points[points.length - 2];
    const current = points[points.length - 1];
    if (!previous.gastos) return null;
    const label = monthName(this.movements.monthOffset() - 1, this.preferences.locale());
    return { percent: ((current.gastos - previous.gastos) / previous.gastos) * 100, previousMonth: label };
  });

  reload(): void {
    this.history.reload();
  }
}
