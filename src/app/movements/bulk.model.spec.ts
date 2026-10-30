import type { AiMovement } from '../ai/ai.model';
import { bulkInputs, bulkReady, bulkTotal, toBulkRows } from './bulk.model';

const ai = (partial: Partial<AiMovement>): AiMovement => ({
  tipo: 'gasto', monto: 100, descripcion: 'x', categoria: 'Supermercado', fuente: null, fecha: '2026-10-21', ...partial,
});

describe('bulk.model', () => {
  const rows = toBulkRows(
    [ai({ descripcion: 'Súper', monto: 20000 }), ai({ categoria: 'Inventada', monto: null, fecha: 'ayer' }), ai({ tipo: 'ingreso', monto: 5000 })],
    ['Supermercado', 'Otros'],
    '2026-10-22',
  );

  it('arma las filas corrigiendo categoría, fecha y fuente', () => {
    expect(rows[1]).toMatchObject({ category: 'Otros', date: '2026-10-22', amount: null });
    expect(rows[2]).toMatchObject({ tipo: 'ingreso', fuente: 'otro' });
  });

  it('no deja guardar si a una fila elegida le falta el monto', () => {
    expect(bulkReady(rows)).toBe(false);
    const without = rows.map((r) => (r.key === 1 ? { ...r, include: false } : r));
    expect(bulkReady(without)).toBe(true);
    expect(bulkReady(rows.map((r) => ({ ...r, include: false })))).toBe(false);
  });

  it('calcula el total con signo y genera los inputs solo de las elegidas', () => {
    const without = rows.map((r) => (r.key === 1 ? { ...r, include: false } : r));
    expect(bulkTotal(without)).toBe(-15000);
    const inputs = bulkInputs(without);
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toMatchObject({ tipo: 'gasto', amount: 20000, category: 'Supermercado', fuente: null, description: 'Súper' });
    expect(inputs[1]).toMatchObject({ tipo: 'ingreso', category: 'Otros', fuente: 'otro' });
  });
});
