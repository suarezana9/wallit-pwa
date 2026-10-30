const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** "hace 5 min", "hace 2 h", "hace 3 días"; menos de un minuto = "ahora". */
export function relativeTime(iso: string, now: Date, locale: string, nowLabel: string): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) < 60) return nowLabel;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.trunc(seconds / size), unit);
  }
  return nowLabel;
}

/** Agrupa por día local (YYYY-MM-DD) conservando el orden (más nuevo primero). */
export function groupByLocalDay<T extends { created_at: string }>(items: readonly T[]): { day: string; items: T[] }[] {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const date = new Date(item.created_at);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}
