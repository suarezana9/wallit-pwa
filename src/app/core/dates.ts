export interface MonthRange {
  from: string;
  to: string;
  label: string;
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

export function monthRange(offset = 0, today = new Date()): MonthRange {
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const month = first.toLocaleDateString('es-AR', { month: 'long' });
  return {
    from: toIsoDate(first),
    to: toIsoDate(last),
    label: `${month.charAt(0).toUpperCase()}${month.slice(1)} ${first.getFullYear()}`,
    isCurrent: offset === 0,
  };
}

export function isInRange(iso: string, range: Pick<MonthRange, 'from' | 'to'>): boolean {
  return iso >= range.from && iso <= range.to;
}

export function relativeDate(iso: string, today = new Date()): string {
  const date = parseIsoDate(iso);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((base.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  const sameYear = date.getFullYear() === base.getFullYear();
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
