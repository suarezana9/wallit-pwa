import type { Recurrente } from '../core/database.types';
import { dateInMonth, pendingFor, recurringFrom, recurringToInput } from './recurring.model';

const rec = (over: Partial<Recurrente>): Recurrente => ({
  id: 'r1', user_id: 'u', group_id: null, tipo: 'gasto', amount: 50000, category: 'Hogar', fuente: null, description: 'Alquiler',
  medio_pago: 'transferencia', division: null, dia: 10, desde: '2026-10', activo: true, saltados: [], created_at: '', ...over,
});

describe('recurring.model', () => {
  it('fecha del mes con el día del fijo', () => {
    expect(dateInMonth('2026-11', 10)).toBe('2026-11-10');
    expect(dateInMonth('2027-02', 31)).toBe('2027-02-28');
  });

  it('pendientes: activos, ya empezados, no salteados, sin registrar y del espacio', () => {
    const list = [
      rec({ id: 'a', dia: 20 }),
      rec({ id: 'b', dia: 5 }),
      rec({ id: 'paused', activo: false }),
      rec({ id: 'future', desde: '2026-12' }),
      rec({ id: 'skipped', saltados: ['2026-11'] }),
      rec({ id: 'done' }),
      rec({ id: 'group', group_id: 'g' }),
    ];
    expect(pendingFor(list, '2026-11', new Set(['done']), null).map((r) => r.id)).toEqual(['b', 'a']);
    expect(pendingFor(list, '2026-11', new Set(), 'g').map((r) => r.id)).toEqual(['group']);
  });

  it('ida y vuelta entre movimiento y fijo', () => {
    const fixed = recurringFrom({
      tipo: 'ingreso', amount: 900000, category: 'Otros', fuente: 'sueldo', description: 'Sueldo', date: '2026-11-05', is_private: false,
    });
    expect(fixed).toMatchObject({ tipo: 'ingreso', dia: 5, desde: '2026-11', activo: true, saltados: [], group_id: null });
    expect(recurringToInput(rec({}), '2026-12', 61000)).toMatchObject({
      amount: 61000, date: '2026-12-10', recurrente_id: 'r1', medio_pago: 'transferencia', group_id: null,
    });
  });
});
