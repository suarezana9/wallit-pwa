import type { Division, Movimiento } from '../core/database.types';
import { computeBalances, divisionGap, equalShares, settleUp, sharesOf } from './balances.model';

const gasto = (amount: number, userId: string, division: Division | null, extra: Partial<Movimiento> = {}): Movimiento => ({
  id: Math.random().toString(), group_id: 'g', user_id: userId, amount, category: 'Otros', description: '', date: '2026-10-01',
  is_private: false, receipt_url: null, created_at: '', tipo: 'gasto', fuente: null, paid_by: null, division, detalle: null, medio_pago: null, compra_id: null, cuota_num: null, cuotas_total: null, recurrente_id: null, ...extra,
});

const all = ['ana', 'luigi', 'sol'];

describe('balances.model', () => {
  it('reparte en partes iguales sin perder centavos', () => {
    expect(equalShares(100, all)).toEqual({ ana: 33.34, luigi: 33.33, sol: 33.33 });
    expect(equalShares(90, ['a', 'a', 'b'])).toEqual({ a: 45, b: 45 });
    expect(sharesOf(10, { tipo: 'montos', partes: { a: 7, b: 3, c: 0 } })).toEqual({ a: 7, b: 3 });
  });

  it('valida que la división por montos cierre con el total', () => {
    expect(divisionGap(100, { tipo: 'montos', partes: { a: 60, b: 40 } })).toBe(0);
    expect(divisionGap(100, { tipo: 'montos', partes: { a: 60, b: 30 } })).toBe(10);
    expect(divisionGap(100, { tipo: 'iguales', entre: all })).toBe(0);
  });

  it('calcula saldos: quien pagó queda a favor y la suma da cero', () => {
    const movements = [
      gasto(30000, 'ana', { tipo: 'iguales', entre: all }),
      gasto(6000, 'luigi', { tipo: 'iguales', entre: ['luigi', 'sol'] }),
    ];
    const balances = computeBalances(movements, [], all);
    const byId = Object.fromEntries(balances.map((b) => [b.userId, b.net]));
    expect(byId).toEqual({ ana: 20000, luigi: -7000, sol: -13000 });
    expect(balances.reduce((sum, b) => sum + b.net, 0)).toBe(0);
  });

  it('usa paid_by y deja afuera privados, ingresos y gastos sin dividir', () => {
    const movements = [
      gasto(1000, 'ana', { tipo: 'iguales', entre: ['ana', 'luigi'] }, { paid_by: 'luigi' }),
      gasto(5000, 'ana', { tipo: 'iguales', entre: all }, { is_private: true }),
      gasto(5000, 'ana', { tipo: 'iguales', entre: all }, { tipo: 'ingreso' }),
      gasto(5000, 'ana', null),
    ];
    const byId = Object.fromEntries(computeBalances(movements, []).map((b) => [b.userId, b.net]));
    expect(byId).toEqual({ luigi: 500, ana: -500 });
  });

  it('un pago entre miembros salda la deuda', () => {
    const movements = [gasto(1000, 'ana', { tipo: 'iguales', entre: ['ana', 'luigi'] })];
    const balances = computeBalances(movements, [{ from_user: 'luigi', to_user: 'ana', amount: 500 }]);
    expect(balances.every((b) => b.net === 0)).toBe(true);
    expect(settleUp(balances)).toEqual([]);
  });

  it('propone pocas transferencias para saldar', () => {
    const transfers = settleUp([
      { userId: 'ana', net: 20000 },
      { userId: 'luigi', net: -7000 },
      { userId: 'sol', net: -13000 },
    ]);
    expect(transfers).toEqual([
      { from: 'sol', to: 'ana', amount: 13000 },
      { from: 'luigi', to: 'ana', amount: 7000 },
    ]);
    const four = settleUp([
      { userId: 'a', net: 50 }, { userId: 'b', net: 30 }, { userId: 'c', net: -60 }, { userId: 'd', net: -20 },
    ]);
    expect(four.length).toBeLessThanOrEqual(3);
    expect(four.reduce((s, t) => s + t.amount, 0)).toBe(80);
  });
});
