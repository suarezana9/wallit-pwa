import type { Movimiento, TipoMovimiento } from '../../core/database.types';
import { payerOf } from '../../groups/balances.model';

export interface DateRange {
  from: string;
  to: string;
}

export interface ExplorerFilters {
  text: string;
  type: TipoMovimiento | 'todos';
  person: string;
  category: string;
  /** Medio de pago (efectivo, débito, crédito, transferencia) o ALL. */
  payment: string;
}

export const ALL = 'todos';

export const EMPTY_FILTERS: ExplorerFilters = { text: '', type: ALL, person: ALL, category: ALL, payment: ALL };

/** Atajos de período del filtro. */
export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'last3' | 'thisYear';

export function presetRange(preset: PeriodPreset, today: Date): DateRange | { monthOffset: number } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  switch (preset) {
    case 'thisMonth':
      return { monthOffset: 0 };
    case 'lastMonth':
      return { monthOffset: -1 };
    case 'last3':
      return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'thisYear':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

/** Cuántos filtros hay activos (para el globito del botón "Filtros"). El texto y el tipo se ven aparte. */
export function activeFilterCount(filters: ExplorerFilters, customRange: boolean): number {
  return [filters.person, filters.category, filters.payment].filter((v) => v !== ALL).length + (customRange ? 1 : 0);
}

const ISO_DATE = /^(\d{4})-\d{2}-\d{2}$/;

/** Aplica un cambio de Desde/Hasta manteniendo Desde ≤ Hasta. null = fecha inválida (se ignora). */
export function applyDateEdge(range: DateRange, edge: 'from' | 'to', value: string): DateRange | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 2000 || year > 2100) return null;
  if (edge === 'from') return { from: value, to: value > range.to ? value : range.to };
  return { from: value < range.from ? value : range.from, to: value };
}

export function normalizeRange(range: DateRange): DateRange {
  return range.from <= range.to ? range : { from: range.to, to: range.from };
}

export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export interface FilterContext {
  categoryName: (name: string) => string;
  authorName: (userId: string) => string;
}

export function applyFilters(list: readonly Movimiento[], filters: ExplorerFilters, ctx: FilterContext): Movimiento[] {
  const query = normalize(filters.text);
  return list.filter((m) => {
    if (filters.type !== ALL && m.tipo !== filters.type) return false;
    if (filters.person !== ALL && payerOf(m) !== filters.person) return false;
    if (filters.category !== ALL && (m.tipo !== 'gasto' || m.category !== filters.category)) return false;
    if (filters.payment !== ALL && m.medio_pago !== filters.payment) return false;
    if (!query) return true;
    const haystack = normalize(`${m.description} ${ctx.categoryName(m.category)} ${ctx.authorName(payerOf(m))}`);
    return haystack.includes(query);
  });
}

export function isFiltered(filters: ExplorerFilters): boolean {
  return (
    !!filters.text.trim() || filters.type !== ALL || filters.person !== ALL || filters.category !== ALL || filters.payment !== ALL
  );
}

export interface DayGroup {
  date: string;
  items: Movimiento[];
  spent: number;
}

export function groupByDay(list: readonly Movimiento[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const m of list) {
    let group = groups.get(m.date);
    if (!group) {
      group = { date: m.date, items: [], spent: 0 };
      groups.set(m.date, group);
    }
    group.items.push(m);
    if (m.tipo === 'gasto') group.spent += Number(m.amount);
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export interface PersonShare {
  userId: string;
  spent: number;
  count: number;
  percent: number;
}

export function spendingByPerson(list: readonly Movimiento[]): PersonShare[] {
  const totals = new Map<string, { spent: number; count: number }>();
  for (const m of list) {
    if (m.tipo !== 'gasto') continue;
    // "Quién gastó" es quien pagó, no quien lo cargó en la app.
    const payer = payerOf(m);
    const t = totals.get(payer) ?? { spent: 0, count: 0 };
    t.spent += Number(m.amount);
    t.count++;
    totals.set(payer, t);
  }
  const sum = [...totals.values()].reduce((s, t) => s + t.spent, 0);
  return [...totals.entries()]
    .map(([userId, t]) => ({ userId, ...t, percent: sum ? Math.round((t.spent / sum) * 100) : 0 }))
    .sort((a, b) => b.spent - a.spent);
}

export interface SheetColumns {
  date: string;
  type: string;
  category: string;
  description: string;
  amount: string;
  person: string | null;
  private: string | null;
}

export interface SheetCell {
  value?: string | number | Date;
  type?: StringConstructor | NumberConstructor | DateConstructor;
  format?: string;
  fontWeight?: 'bold';
}

export interface SheetOptions {
  columns: SheetColumns;
  dateFormat: string;
  yes: string;
  typeName: (tipo: TipoMovimiento) => string;
  categoryName: (name: string) => string;
  authorName: (userId: string) => string;
}

export function isoToUtcDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Filas para la planilla: encabezado en negrita, fecha como fecha real y monto como número. */
export function toSheetRows(list: readonly Movimiento[], options: SheetOptions): SheetCell[][] {
  const { columns } = options;
  const headers = [columns.date, columns.type, columns.category, columns.description, columns.amount];
  if (columns.person) headers.push(columns.person);
  if (columns.private) headers.push(columns.private);
  const header = headers.map((value) => ({ value, fontWeight: 'bold' as const }));

  const rows = list.map((m) => {
    const row: SheetCell[] = [
      { value: isoToUtcDate(m.date), type: Date, format: options.dateFormat },
      { value: options.typeName(m.tipo), type: String },
      { value: m.tipo === 'gasto' ? options.categoryName(m.category) : '', type: String },
      { value: m.description, type: String },
      { value: Number(m.amount), type: Number, format: '#,##0.00' },
    ];
    if (columns.person) row.push({ value: options.authorName(payerOf(m)), type: String });
    if (columns.private) row.push({ value: m.is_private ? options.yes : '', type: String });
    return row;
  });
  return [header, ...rows];
}
