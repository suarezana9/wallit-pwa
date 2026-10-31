import type { MovementInput } from './movement.model';
import { addMonths, buildInstallments, futurePurchases, splitAmount } from './installments.model';

const input: MovementInput = {
  tipo: 'gasto', amount: 100000, category: 'Hogar', fuente: null, description: 'Heladera', date: '2026-01-31',
  is_private: false, medio_pago: 'credito', receipt_url: 'r.jpg', detalle: { total: 1 },
};

describe('installments.model', () => {
  it('reparte sin perder centavos', () => {
    expect(splitAmount(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitAmount(100000, 12).reduce((s, v) => s + v, 0)).toBeCloseTo(100000, 2);
  });

  it('suma meses respetando el fin de mes', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('arma una cuota por mes con el mismo compra_id', () => {
    const rows = buildInstallments(input, 3, { startNextMonth: false, compraId: 'c1' });
    expect(rows.map((r) => [r.date, r.amount, r.cuota_num, r.cuotas_total])).toEqual([
      ['2026-01-31', 33333.34, 1, 3],
      ['2026-02-28', 33333.33, 2, 3],
      ['2026-03-31', 33333.33, 3, 3],
    ]);
    expect(rows.every((r) => r.compra_id === 'c1' && r.detalle === null)).toBe(true);
    expect(rows.map((r) => r.receipt_url)).toEqual(['r.jpg', null, null]);
    expect(buildInstallments(input, 2, { startNextMonth: true, compraId: 'c' })[0].date).toBe('2026-02-28');
    expect(buildInstallments(input, 1, { startNextMonth: false, compraId: 'c' })).toEqual([input]);
  });

  it('con división por montos, cada persona paga su parte en cuotas', () => {
    const rows = buildInstallments({ ...input, amount: 100, division: { tipo: 'montos', partes: { a: 70, b: 30 } } }, 3, {
      startNextMonth: false, compraId: 'c',
    });
    for (const row of rows) {
      const parts = row.division?.tipo === 'montos' ? Object.values(row.division.partes) : [];
      expect(parts.reduce((s, v) => s + v, 0)).toBeCloseTo(row.amount, 2);
    }
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBeCloseTo(100, 2);
  });

  it('resume las cuotas por venir', () => {
    const row = (date: string, n: number) => ({
      compra_id: 'c', amount: 1000, date, description: 'TV', category: 'Tecnología', cuota_num: n, cuotas_total: 6,
    });
    const list = futurePurchases([row('2026-10-05', 3), row('2026-11-05', 4), row('2026-12-05', 5), row('2027-01-05', 6)], '2026-10-31');
    expect(list).toEqual([
      { compraId: 'c', description: 'TV', category: 'Tecnología', installment: 1000, remaining: 3000, remainingCount: 3, total: 6, paidCount: 3, nextDate: '2026-11-05' },
    ]);
  });
});
