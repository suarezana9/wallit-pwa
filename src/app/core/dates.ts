export interface MonthRange {
  from: string;
  to: string;
  isCurrent: boolean;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function firstOfMonth(offset: number, today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth() + offset, 1);
}

export function monthRange(offset = 0, today = new Date()): MonthRange {
  const first = firstOfMonth(offset, today);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { from: toIsoDate(first), to: toIsoDate(last), isCurrent: offset === 0 };
}

export function monthName(offset: number, locale = 'es-AR', style: 'long' | 'short' = 'long', today = new Date()): string {
  return firstOfMonth(offset, today).toLocaleDateString(locale, { month: style }).replace('.', '');
}

export function monthLabel(offset = 0, locale = 'es-AR', today = new Date()): string {
  const name = monthName(offset, locale, 'long', today);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${firstOfMonth(offset, today).getFullYear()}`;
}

export function isInRange(iso: string, range: Pick<MonthRange, 'from' | 'to'>): boolean {
  return iso >= range.from && iso <= range.to;
}

export interface RelativeLabels {
  today: string;
  yesterday: string;
}

export function relativeDate(
  iso: string,
  today = new Date(),
  locale = 'es-AR',
  labels: RelativeLabels = { today: 'Hoy', yesterday: 'Ayer' },
): string {
  const date = parseIsoDate(iso);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((base.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  const sameYear = date.getFullYear() === base.getFullYear();
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
