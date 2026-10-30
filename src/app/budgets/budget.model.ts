import type { Database } from '../core/database.types';

export type Budget = Database['public']['Tables']['budgets']['Row'];

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface BudgetProgress {
  budget: Budget;
  limit: number;
  spent: number;
  remaining: number;
  percent: number;
  status: BudgetStatus;
  byCategory: { name: string; amount: number }[];
}

export interface BudgetInput {
  name: string;
  amount_limit: number;
  categories: string[];
}

/** Clave del mes en el formato que guarda la base: 2026-10. */
export function monthKey(offset = 0, today = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function statusFor(percent: number): BudgetStatus {
  if (percent >= 100) return 'over';
  if (percent >= 80) return 'warning';
  return 'ok';
}

export function spendingByCategory(rows: readonly { category: string; amount: number | string }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const r of rows) totals[r.category] = (totals[r.category] ?? 0) + Number(r.amount);
  return totals;
}

export function progressOf(budget: Budget, byCategory: Record<string, number>): BudgetProgress {
  const limit = Number(budget.amount_limit);
  const breakdown = budget.categories
    .map((name) => ({ name, amount: byCategory[name] ?? 0 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const spent = breakdown.reduce((s, c) => s + c.amount, 0);
  const percent = limit > 0 ? (spent / limit) * 100 : 0;
  return { budget, limit, spent, remaining: limit - spent, percent, status: statusFor(percent), byCategory: breakdown };
}

/** Cuánto se puede gastar por día hasta fin de mes sin pasarse (solo para el mes en curso). */
export function dailyAllowance(remaining: number, today = new Date()): number | null {
  if (remaining <= 0) return null;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - today.getDate() + 1;
  return remaining / daysLeft;
}

export function totals(progress: readonly BudgetProgress[]): { limit: number; spent: number } {
  return progress.reduce((t, p) => ({ limit: t.limit + p.limit, spent: t.spent + p.spent }), { limit: 0, spent: 0 });
}
