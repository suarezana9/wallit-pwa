import type { Movimiento } from '../core/database.types';
import { summarize } from './movement.model';

const mov = (tipo: Movimiento['tipo'], amount: number): Movimiento => ({
  id: crypto.randomUUID(), group_id: null, user_id: 'u', amount, category: 'Otros', description: '',
  date: '2026-10-10', is_private: false, receipt_url: null, created_at: '', tipo, fuente: null, paid_by: null, division: null, detalle: null, medio_pago: null, compra_id: null, cuota_num: null, cuotas_total: null, recurrente_id: null,
});

describe('summarize', () => {
  it('calcula disponible y tasa de ahorro', () => {
    const s = summarize([mov('ingreso', 1000), mov('gasto', 300), mov('ahorro', 100), mov('inversion', 100)]);
    expect(s).toMatchObject({ ingresos: 1000, gastos: 300, ahorros: 100, inversiones: 100, disponible: 500 });
    expect(s.tasaAhorro).toBe(20);
  });

  it('sin ingresos no hay tasa de ahorro', () => {
    expect(summarize([mov('gasto', 50)]).tasaAhorro).toBeNull();
  });
});
