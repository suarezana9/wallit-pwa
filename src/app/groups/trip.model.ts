import { parseIsoDate } from '../core/dates';
import type { Grupo, Movimiento } from '../core/database.types';

export type TripStatus = 'undated' | 'upcoming' | 'ongoing' | 'ended';

const DAY_MS = 24 * 60 * 60 * 1000;

function shortDate(iso: string, locale: string, withMonth = true): string {
  const date = parseIsoDate(iso);
  return withMonth
    ? date.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace(/\./g, '').replace(/ de /g, ' ')
    : String(date.getDate());
}

/** "12–18 nov", "28 oct – 3 nov" o "desde 12 nov". */
export function formatTripRange(from: string | null, to: string | null, locale: string, sinceLabel = 'desde'): string {
  if (!from && !to) return '';
  if (from && !to) return `${sinceLabel} ${shortDate(from, locale)}`;
  if (!from && to) return shortDate(to, locale);
  const sameMonth = from!.slice(0, 7) === to!.slice(0, 7);
  return sameMonth ? `${shortDate(from!, locale, false)}–${shortDate(to!, locale)}` : `${shortDate(from!, locale)} – ${shortDate(to!, locale)}`;
}

export function tripStatus(group: Pick<Grupo, 'fecha_inicio' | 'fecha_fin'>, today: string): TripStatus {
  const { fecha_inicio: from, fecha_fin: to } = group;
  if (!from && !to) return 'undated';
  if (from && today < from) return 'upcoming';
  if (to && today > to) return 'ended';
  return 'ongoing';
}

export interface TripSummary {
  total: number;
  perPerson: number;
  days: number;
  perDay: number;
  topCategories: { name: string; total: number }[];
}

/** Resumen de un viaje con los gastos de grupo no privados. Los días salen de las fechas o, si no hay, de los gastos. */
export function tripSummary(
  movements: readonly Movimiento[],
  memberCount: number,
  group: Pick<Grupo, 'fecha_inicio' | 'fecha_fin'>,
): TripSummary {
  const gastos = movements.filter((m) => m.tipo === 'gasto' && !m.is_private);
  const total = Math.round(gastos.reduce((sum, m) => sum + Number(m.amount), 0) * 100) / 100;

  const dates = gastos.map((m) => m.date).sort();
  const from = group.fecha_inicio ?? dates[0];
  const to = group.fecha_fin ?? dates.at(-1);
  const days = from && to ? Math.max(1, Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS) + 1) : 1;

  const byCategory = new Map<string, number>();
  for (const m of gastos) byCategory.set(m.category, (byCategory.get(m.category) ?? 0) + Number(m.amount));
  const topCategories = [...byCategory.entries()]
    .map(([name, value]) => ({ name, total: value }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  return {
    total,
    perPerson: memberCount ? Math.round((total / memberCount) * 100) / 100 : total,
    days,
    perDay: Math.round((total / days) * 100) / 100,
    topCategories,
  };
}
