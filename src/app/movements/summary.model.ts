import type { Movimiento } from '../core/database.types';

/**
 * Resumen mensual: comparación de un mes con el anterior, sin Angular ni red.
 * Lo usan la pantalla del resumen, los textos de respaldo (si la IA no está) y el pedido a la IA.
 * Los pagos de tarjeta no cuentan como gasto (las compras ya están cargadas).
 */

export interface CategoryChange {
  category: string;
  current: number;
  previous: number;
  /** Diferencia en plata (positivo = gastaste más). */
  delta: number;
  /** Diferencia en %; null si el mes anterior no hubo gasto en esa categoría. */
  pct: number | null;
}

export interface MonthReport {
  month: string;
  previousMonth: string;
  gastos: number;
  gastosAnterior: number;
  /** % de cambio del gasto total; null sin datos del mes anterior. */
  gastosPct: number | null;
  ingresos: number;
  ahorro: number;
  /** (ahorro + inversiones) / ingresos, en %. */
  tasaAhorro: number | null;
  count: number;
  categories: CategoryChange[];
  /** Las que más subieron y bajaron (en plata), máximo 3 cada una. */
  topUp: CategoryChange[];
  topDown: CategoryChange[];
  biggest: { description: string; category: string; amount: number; date: string } | null;
}

const sum = (list: readonly Movimiento[]) => list.reduce((s, m) => s + Number(m.amount), 0);
const round = (n: number) => Math.round(n * 100) / 100;
const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** Una categoría cuenta como "cambio" si se movió al menos 10% y una plata que se note (5% del total). */
function meaningful(c: CategoryChange, total: number): boolean {
  return Math.abs(c.delta) >= Math.max(1, total * 0.05) && (c.pct === null || Math.abs(c.pct) >= 10);
}

export function buildReport(month: string, previousMonth: string, current: readonly Movimiento[], previous: readonly Movimiento[]): MonthReport {
  const gastosNow = current.filter((m) => m.tipo === 'gasto');
  const gastosBefore = previous.filter((m) => m.tipo === 'gasto');
  const gastos = round(sum(gastosNow));
  const gastosAnterior = round(sum(gastosBefore));
  const ingresos = round(sum(current.filter((m) => m.tipo === 'ingreso')));
  const ahorro = round(sum(current.filter((m) => m.tipo === 'ahorro' || m.tipo === 'inversion')));

  const byCat = new Map<string, { current: number; previous: number }>();
  for (const m of gastosNow) {
    const c = byCat.get(m.category) ?? { current: 0, previous: 0 };
    c.current += Number(m.amount);
    byCat.set(m.category, c);
  }
  for (const m of gastosBefore) {
    const c = byCat.get(m.category) ?? { current: 0, previous: 0 };
    c.previous += Number(m.amount);
    byCat.set(m.category, c);
  }
  const categories = [...byCat.entries()]
    .map(([category, v]) => ({
      category,
      current: round(v.current),
      previous: round(v.previous),
      delta: round(v.current - v.previous),
      pct: pct(v.current, v.previous),
    }))
    .sort((a, b) => b.current - a.current);

  const scale = Math.max(gastos, gastosAnterior);
  const changes = categories.filter((c) => gastosAnterior > 0 && meaningful(c, scale));
  const biggestMov = [...gastosNow].sort((a, b) => Number(b.amount) - Number(a.amount))[0];

  return {
    month,
    previousMonth,
    gastos,
    gastosAnterior,
    gastosPct: pct(gastos, gastosAnterior),
    ingresos,
    ahorro,
    tasaAhorro: ingresos > 0 ? Math.round((ahorro / ingresos) * 100) : null,
    count: current.length,
    categories,
    topUp: changes.filter((c) => c.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
    topDown: changes.filter((c) => c.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
    biggest: biggestMov
      ? { description: biggestMov.description, category: biggestMov.category, amount: Number(biggestMov.amount), date: biggestMov.date }
      : null,
  };
}

/** Lo que se le manda a la IA: números ya calculados, sin descripciones ni nombres (privacidad y menos tokens). */
export function reportForAi(r: MonthReport, categoryName: (n: string) => string) {
  return {
    mes: r.month,
    gastos: r.gastos,
    gastos_mes_anterior: r.gastosAnterior,
    variacion_gastos_pct: r.gastosPct,
    ingresos: r.ingresos,
    ahorro_e_inversion: r.ahorro,
    tasa_ahorro_pct: r.tasaAhorro,
    movimientos: r.count,
    categorias: r.categories.slice(0, 8).map((c) => ({
      nombre: categoryName(c.category),
      actual: c.current,
      anterior: c.previous,
      variacion_pct: c.pct,
    })),
  };
}

export interface SummaryText {
  title: string;
  points: string[];
  tip: string | null;
}

/** Textos armados con reglas, para cuando la IA no está (o se llegó al límite del día). */
export function fallbackSummary(
  r: MonthReport,
  t: {
    money: (n: number) => string;
    category: (n: string) => string;
    titleUp: (pct: string) => string;
    titleDown: (pct: string) => string;
    titleFlat: string;
    titleFirst: string;
    up: (cat: string, amount: string, pct: string) => string;
    down: (cat: string, amount: string) => string;
    top: (cat: string, amount: string) => string;
    saving: (pct: string) => string;
  },
): SummaryText {
  const title =
    r.gastosPct === null ? t.titleFirst : r.gastosPct >= 3 ? t.titleUp(String(r.gastosPct)) : r.gastosPct <= -3 ? t.titleDown(String(Math.abs(r.gastosPct))) : t.titleFlat;
  const points: string[] = [];
  const up = r.topUp[0];
  if (up) points.push(t.up(t.category(up.category), t.money(up.delta), up.pct === null ? '' : String(up.pct)));
  const down = r.topDown[0];
  if (down) points.push(t.down(t.category(down.category), t.money(Math.abs(down.delta))));
  const first = r.categories[0];
  if (first && points.length < 2) points.push(t.top(t.category(first.category), t.money(first.current)));
  if (r.tasaAhorro !== null) points.push(t.saving(String(r.tasaAhorro)));
  return { title, points: points.slice(0, 3), tip: null };
}

/** El mes anterior a 'YYYY-MM'. */
export function previousMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** "2026-10" → "octubre" (o "October"). */
export function monthNameOf(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long' });
}

/** Cuántos meses hay entre 'YYYY-MM' y el mes de hoy (negativo = pasado), para moverse en el selector de mes. */
export function monthOffsetOf(month: string, today = new Date()): number {
  const [y, m] = month.split('-').map(Number);
  return (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth());
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
