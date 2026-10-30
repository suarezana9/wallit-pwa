import type { Movimiento } from '../../core/database.types';
import {
  activeFilterCount, applyDateEdge, EMPTY_FILTERS, applyFilters, groupByDay, normalizeRange, presetRange, spendingByPerson, toSheetRows } from './explorer.model';

const mov = (over: Partial<Movimiento>): Movimiento => ({
  id: Math.random().toString(), group_id: 'g1', user_id: 'ana', amount: 100, category: 'Supermercado',
  description: '', date: '2026-10-10', is_private: false, receipt_url: null, created_at: '', tipo: 'gasto', fuente: null, paid_by: null, division: null, detalle: null, medio_pago: null,
  ...over,
});

const ctx = {
  categoryName: (n: string) => n,
  authorName: (id: string) => ({ ana: 'Ana Suárez', juan: 'Juan Pérez' })[id] ?? '',
};

describe('explorer.model', () => {
  it('ordena el rango si las fechas vienen invertidas', () => {
    expect(normalizeRange({ from: '2026-10-20', to: '2026-10-01' })).toEqual({ from: '2026-10-01', to: '2026-10-20' });
    expect(normalizeRange({ from: '2026-01-01', to: '2026-10-01' })).toEqual({ from: '2026-01-01', to: '2026-10-01' });
  });

  it('filtra por texto sin importar tildes, por persona y por categoría', () => {
    const list = [
      mov({ description: 'Compra del súper' }),
      mov({ description: 'Pizza', category: 'Delivery', user_id: 'juan' }),
      mov({ description: 'Sueldo', tipo: 'ingreso', category: 'Otros' }),
    ];
    expect(applyFilters(list, { ...EMPTY_FILTERS, text: 'super' }, ctx).length).toBe(1);
    expect(applyFilters(list, { ...EMPTY_FILTERS, text: 'perez' }, ctx)[0].description).toBe('Pizza');
    expect(applyFilters(list, { ...EMPTY_FILTERS, person: 'ana' }, ctx).length).toBe(2);
    expect(applyFilters(list, { ...EMPTY_FILTERS, category: 'Delivery' }, ctx).length).toBe(1);
    expect(applyFilters(list, { ...EMPTY_FILTERS, type: 'ingreso' }, ctx).length).toBe(1);
  });

  it('agrupa por día con el total gastado', () => {
    const days = groupByDay([mov({ date: '2026-10-10', amount: 50 }), mov({ date: '2026-10-12' }), mov({ date: '2026-10-10', tipo: 'ingreso' })]);
    expect(days.map((d) => d.date)).toEqual(['2026-10-12', '2026-10-10']);
    expect(days[1]).toMatchObject({ spent: 50 });
    expect(days[1].items.length).toBe(2);
  });

  it('reparte los gastos por persona', () => {
    const shares = spendingByPerson([mov({ amount: 300 }), mov({ user_id: 'juan', amount: 100 }), mov({ tipo: 'ingreso', amount: 999 })]);
    expect(shares).toEqual([
      { userId: 'ana', spent: 300, count: 1, percent: 75 },
      { userId: 'juan', spent: 100, count: 1, percent: 25 },
    ]);
  });

  it('arma la planilla con fecha real, monto numérico y persona', () => {
    const rows = toSheetRows([mov({ description: 'Pan; leche', amount: 10.5, is_private: true })], {
      columns: { date: 'Fecha', type: 'Tipo', category: 'Categoría', description: 'Descripción', amount: 'Monto', person: 'Persona', private: 'Privado' },
      dateFormat: 'dd/mm/yyyy', yes: 'Sí', typeName: () => 'Gasto', categoryName: (n) => n, authorName: ctx.authorName,
    });
    expect(rows[0].map((c) => c.value)).toEqual(['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Persona', 'Privado']);
    expect(rows[0][0].fontWeight).toBe('bold');
    const [date, , category, description, amount, person, priv] = rows[1];
    expect((date.value as Date).toISOString().slice(0, 10)).toBe('2026-10-10');
    expect(amount).toMatchObject({ value: 10.5, type: Number });
    expect([category.value, description.value, person.value, priv.value]).toEqual(['Supermercado', 'Pan; leche', 'Ana Suárez', 'Sí']);
  });
});

describe('explorer.model con quién pagó', () => {
  it('el gasto por persona y el filtro usan paid_by', () => {
    const list = [mov({ user_id: 'ana', paid_by: 'juan', amount: 100 })];
    expect(spendingByPerson(list)[0].userId).toBe('juan');
  });
});

describe('rango de fechas del explorador', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  it('nunca deja Desde después de Hasta', () => {
    expect(applyDateEdge(range, 'from', '2026-11-15')).toEqual({ from: '2026-11-15', to: '2026-11-15' });
    expect(applyDateEdge(range, 'to', '2026-09-10')).toEqual({ from: '2026-09-10', to: '2026-09-10' });
    expect(applyDateEdge(range, 'to', '2026-12-31')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
  });
  it('descarta fechas incompletas o absurdas', () => {
    expect(applyDateEdge(range, 'from', '')).toBeNull();
    expect(applyDateEdge(range, 'from', '0202-10-01')).toBeNull();
  });
});

describe('explorer.model: períodos y filtros nuevos', () => {
  it('atajos de período', () => {
    const today = new Date(2026, 9, 30);
    expect(presetRange('thisMonth', today)).toEqual({ monthOffset: 0 });
    expect(presetRange('lastMonth', today)).toEqual({ monthOffset: -1 });
    expect(presetRange('last3', today)).toEqual({ from: '2026-08-01', to: '2026-10-31' });
    expect(presetRange('thisYear', new Date(2026, 0, 1))).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(presetRange('last3', new Date(2026, 0, 15))).toEqual({ from: '2025-11-01', to: '2026-01-31' });
  });

  it('cuenta filtros activos y filtra por medio de pago', () => {
    expect(activeFilterCount(EMPTY_FILTERS, false)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, category: 'Bar', payment: 'credito', text: 'x' }, true)).toBe(3);
    const credit = mov({ id: 'a', medio_pago: 'credito' });
    const cash = mov({ id: 'b', medio_pago: 'efectivo' });
    expect(applyFilters([credit, cash], { ...EMPTY_FILTERS, payment: 'credito' }, ctx).map((m) => m.id)).toEqual(['a']);
  });
});
