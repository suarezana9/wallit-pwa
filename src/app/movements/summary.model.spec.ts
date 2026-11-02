import type { Movimiento } from '../core/database.types';
import {
  buildReport, fallbackSummary, isMonthKey, monthBounds, monthOffsetOf, previousMonthOf, reportForAi,
} from './summary.model';

const mov = (partial: Partial<Movimiento>): Movimiento =>
  ({ id: crypto.randomUUID(), tipo: 'gasto', amount: 0, category: 'Otros', description: '', date: '2026-10-05', ...partial }) as Movimiento;

const t = {
  money: (n: number) => `$${n}`,
  category: (n: string) => n,
  titleUp: (p: string) => `up ${p}`,
  titleDown: (p: string) => `down ${p}`,
  titleFlat: 'flat',
  titleFirst: 'first',
  up: (c: string, a: string, p: string) => `${c} +${a} ${p}`,
  down: (c: string, a: string) => `${c} -${a}`,
  top: (c: string, a: string) => `top ${c} ${a}`,
  saving: (p: string) => `saving ${p}`,
};

describe('summary.model', () => {
  const current = [
    mov({ category: 'Supermercado', amount: 60000, description: 'Coto' }),
    mov({ category: 'Supermercado', amount: 20000 }),
    mov({ category: 'Delivery', amount: 5000 }),
    mov({ tipo: 'ingreso', category: 'Trabajo', amount: 500000 }),
    mov({ tipo: 'ahorro', category: 'Banco', amount: 50000 }),
    mov({ tipo: 'pago_tarjeta', category: 'Tarjeta de crédito', amount: 99999 }),
  ];
  const previous = [
    mov({ category: 'Supermercado', amount: 40000, date: '2026-09-10' }),
    mov({ category: 'Delivery', amount: 30000, date: '2026-09-11' }),
  ];

  it('compara gastos por categoría e ignora pagos de tarjeta', () => {
    const r = buildReport('2026-10', '2026-09', current, previous);
    expect(r.gastos).toBe(85000);
    expect(r.gastosAnterior).toBe(70000);
    expect(r.gastosPct).toBe(21);
    expect(r.ingresos).toBe(500000);
    expect(r.tasaAhorro).toBe(10);
    expect(r.topUp.map((c) => c.category)).toEqual(['Supermercado']);
    expect(r.topUp[0].pct).toBe(100);
    expect(r.topDown.map((c) => c.category)).toEqual(['Delivery']);
    expect(r.biggest?.description).toBe('Coto');
  });

  it('sin mes anterior no inventa variaciones', () => {
    const r = buildReport('2026-10', '2026-09', current, []);
    expect(r.gastosPct).toBeNull();
    expect(r.topUp).toEqual([]);
    expect(fallbackSummary(r, t).title).toBe('first');
  });

  it('arma un texto de respaldo con lo que más cambió', () => {
    const s = fallbackSummary(buildReport('2026-10', '2026-09', current, previous), t);
    expect(s.title).toBe('up 21');
    expect(s.points).toEqual(['Supermercado +$40000 100', 'Delivery -$25000', 'saving 10']);
    expect(s.tip).toBeNull();
  });

  it('a la IA le manda números, no descripciones', () => {
    const payload = reportForAi(buildReport('2026-10', '2026-09', current, previous), (n) => n.toUpperCase());
    expect(JSON.stringify(payload)).not.toContain('Coto');
    expect(payload.categorias[0].nombre).toBe('SUPERMERCADO');
  });

  it('maneja los meses', () => {
    expect(previousMonthOf('2026-01')).toBe('2025-12');
    expect(monthBounds('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthOffsetOf('2026-09', new Date(2026, 10, 1))).toBe(-2);
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey(null)).toBe(false);
  });
});
