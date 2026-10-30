import type { Budget } from './budget.model';
import { dailyAllowance, monthKey, progressOf, spendingByCategory, statusFor, totals } from './budget.model';

const budget = (over: Partial<Budget> = {}): Budget => ({
  id: 'b1', group_id: null, user_id: 'u1', name: 'Casa', categories: ['Supermercado', 'Servicios'],
  amount_limit: 100000, month: '2026-10', created_at: '', ...over,
});

describe('budget.model', () => {
  it('arma la clave del mes', () => {
    const today = new Date(2026, 0, 15);
    expect(monthKey(0, today)).toBe('2026-01');
    expect(monthKey(-1, today)).toBe('2025-12');
  });

  it('marca el estado según el porcentaje', () => {
    expect(statusFor(50)).toBe('ok');
    expect(statusFor(80)).toBe('warning');
    expect(statusFor(100)).toBe('over');
  });

  it('suma solo las categorías del presupuesto', () => {
    const byCategory = spendingByCategory([
      { category: 'Supermercado', amount: 60000 },
      { category: 'Servicios', amount: '25000' },
      { category: 'Ocio', amount: 99999 },
    ]);
    const p = progressOf(budget(), byCategory);
    expect(p).toMatchObject({ spent: 85000, remaining: 15000, status: 'warning' });
    expect(p.byCategory.map((c) => c.name)).toEqual(['Supermercado', 'Servicios']);
  });

  it('calcula cuánto se puede gastar por día', () => {
    expect(dailyAllowance(31000, new Date(2026, 9, 1))).toBe(1000);
    expect(dailyAllowance(-5, new Date(2026, 9, 1))).toBeNull();
  });

  it('totaliza límites y gastos', () => {
    const list = [progressOf(budget(), { Supermercado: 10 }), progressOf(budget({ amount_limit: 50 }), {})];
    expect(totals(list)).toEqual({ limit: 100050, spent: 10 });
  });
});
