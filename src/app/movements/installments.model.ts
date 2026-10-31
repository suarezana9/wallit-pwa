import type { Division } from '../core/database.types';
import { parseIsoDate, toIsoDate } from '../core/dates';
import type { MovementInput } from './movement.model';

/** Opciones rápidas de cuotas; "1" es sin cuotas. */
export const INSTALLMENT_PRESETS = [1, 3, 6, 9, 12, 18, 24] as const;
export const MAX_INSTALLMENTS = 60;

/** Reparte un total en n partes sin perder centavos: lo que sobra va en las primeras cuotas. */
export function splitAmount(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}

/** Suma meses a una fecha; si el día no existe (31 en un mes de 30), queda el último del mes. */
export function addMonths(iso: string, months: number): string {
  const date = parseIsoDate(iso);
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return toIsoDate(target);
}

export interface InstallmentPlan {
  /** Monto de cada cuota (la primera puede tener algún centavo más). */
  amounts: number[];
  dates: string[];
}

export function installmentPlan(total: number, count: number, date: string, startNextMonth: boolean): InstallmentPlan {
  const offset = startNextMonth ? 1 : 0;
  return {
    amounts: splitAmount(total, count),
    dates: Array.from({ length: count }, (_, i) => addMonths(date, i + offset)),
  };
}

/**
 * Una compra en cuotas se guarda como un movimiento por mes. Así cada mes suma solo la cuota que le toca,
 * y los totales, presupuestos y saldos del grupo funcionan sin tratarlas distinto.
 * Si la división es por montos, cada persona paga su parte también en cuotas, y el monto de cada cuota
 * es la suma de esas partes (así siempre cierra al centavo).
 */
export function buildInstallments(
  input: MovementInput,
  count: number,
  options: { startNextMonth: boolean; compraId: string },
): MovementInput[] {
  if (count < 2) return [input];
  const plan = installmentPlan(input.amount, count, input.date, options.startNextMonth);
  const divisions = splitDivision(input.division ?? null, count);
  return plan.dates.map((date, i) => {
    const division = divisions[i];
    const amount = division?.tipo === 'montos' ? round(Object.values(division.partes).reduce((s, v) => s + v, 0)) : plan.amounts[i];
    return {
      ...input,
      amount,
      date,
      division,
      detalle: null,
      // El comprobante queda en la primera cuota (borrar las otras no lo toca).
      receipt_url: i === 0 ? input.receipt_url : null,
      compra_id: options.compraId,
      cuota_num: i + 1,
      cuotas_total: count,
    };
  });
}

function splitDivision(division: Division | null, count: number): (Division | null)[] {
  if (division?.tipo !== 'montos') return Array.from({ length: count }, () => division);
  const perMember = Object.entries(division.partes).map(([id, part]) => [id, splitAmount(part, count)] as const);
  return Array.from({ length: count }, (_, i) => ({
    tipo: 'montos' as const,
    partes: Object.fromEntries(perMember.map(([id, parts]) => [id, parts[i]])),
  }));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface FuturePurchase {
  compraId: string;
  description: string;
  category: string;
  /** Monto de la próxima cuota. */
  installment: number;
  remaining: number;
  remainingCount: number;
  total: number;
  /** Cuotas ya pagadas (las de meses anteriores o el actual). */
  paidCount: number;
  nextDate: string;
}

export interface InstallmentRow {
  compra_id: string | null;
  amount: number;
  date: string;
  description: string;
  category: string;
  cuota_num: number | null;
  cuotas_total: number | null;
}

/** Compras con cuotas por venir (después de `after`), de la que termina antes a la que termina después. */
export function futurePurchases(rows: readonly InstallmentRow[], after: string): FuturePurchase[] {
  const byPurchase = new Map<string, InstallmentRow[]>();
  for (const row of rows) {
    if (!row.compra_id) continue;
    byPurchase.set(row.compra_id, [...(byPurchase.get(row.compra_id) ?? []), row]);
  }
  const result: FuturePurchase[] = [];
  for (const [compraId, list] of byPurchase) {
    const future = list.filter((r) => r.date > after).sort((a, b) => a.date.localeCompare(b.date));
    if (!future.length) continue;
    const first = future[0];
    const total = first.cuotas_total ?? future.length;
    result.push({
      compraId,
      description: first.description,
      category: first.category,
      installment: Number(first.amount),
      remaining: round(future.reduce((s, r) => s + Number(r.amount), 0)),
      remainingCount: future.length,
      total,
      paidCount: total - future.length,
      nextDate: first.date,
    });
  }
  return result.sort((a, b) => a.remainingCount - b.remainingCount || a.nextDate.localeCompare(b.nextDate));
}
