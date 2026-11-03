/**
 * "Ritmo del mes": cuánto llevás gastado día a día, cuánto te queda por día y cómo venís contra el mes anterior
 * a la misma altura. Sin Angular ni red: se prueba solo.
 */

export interface PaceRow {
  tipo: string;
  amount: number | string;
  date: string;
}

export interface Pace {
  /** Días del mes (28 a 31). */
  days: number;
  /** Día de hoy si el mes es el actual; null si es un mes pasado (o futuro). */
  today: number | null;
  /** Gasto acumulado por día, del día 1 hasta hoy (o hasta fin de mes si ya pasó). */
  cumulative: number[];
  /** Lo mismo para el mes anterior, completo. null si ese mes no tuvo gastos. */
  previous: number[] | null;
  spent: number;
  /** Días que faltan contando hoy (solo en el mes actual). */
  daysLeft: number | null;
  /** Disponible / días que faltan. null si no hay ingresos o el mes no es el actual. */
  perDay: number | null;
  /** Gastado hasta hoy menos lo gastado el mes anterior al mismo día (negativo = vas mejor). */
  vsPrevious: number | null;
}

function daysIn(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Acumulado de gastos día a día para un mes 'YYYY-MM', hasta el día `upTo` incluido. */
export function cumulativeByDay(rows: readonly PaceRow[], month: string, upTo: number): number[] {
  const daily = new Array<number>(upTo).fill(0);
  for (const r of rows) {
    if (r.tipo !== 'gasto' || !r.date.startsWith(month)) continue;
    const day = Number(r.date.slice(8, 10));
    if (day >= 1 && day <= upTo) daily[day - 1] += Number(r.amount);
  }
  let total = 0;
  return daily.map((v) => (total += v));
}

export function paceOf(input: {
  month: string;
  previousMonth: string;
  current: readonly PaceRow[];
  previous: readonly PaceRow[];
  ingresos: number;
  disponible: number;
  now?: Date;
}): Pace {
  const now = input.now ?? new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const days = daysIn(input.month);
  const today = input.month === nowKey ? now.getDate() : null;
  const upTo = today ?? (input.month < nowKey ? days : 0);
  const cumulative = cumulativeByDay(input.current, input.month, upTo);
  const spent = cumulative.at(-1) ?? 0;

  const previousDays = daysIn(input.previousMonth);
  const prevCum = cumulativeByDay(input.previous, input.previousMonth, previousDays);
  const previous = (prevCum.at(-1) ?? 0) > 0 ? prevCum : null;

  const daysLeft = today === null ? null : days - today + 1;
  const perDay = daysLeft && input.ingresos > 0 ? Math.max(0, input.disponible) / daysLeft : null;
  const compareDay = Math.min(upTo, previousDays);
  const vsPrevious = previous && compareDay > 0 ? spent - previous[compareDay - 1] : null;

  return { days, today, cumulative, previous, spent, daysLeft, perDay, vsPrevious };
}
