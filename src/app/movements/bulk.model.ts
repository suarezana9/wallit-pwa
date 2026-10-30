import type { FuenteIngreso, TipoMovimiento } from '../core/database.types';
import type { AiMovement } from '../ai/ai.model';
import type { MovementInput } from './movement.model';

/** Una fila de la revisión cuando la IA encontró varios movimientos. */
export interface BulkRow {
  key: number;
  include: boolean;
  tipo: TipoMovimiento;
  amount: number | null;
  category: string;
  fuente: FuenteIngreso | null;
  description: string;
  date: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toBulkRows(list: readonly AiMovement[], categories: readonly string[], today: string): BulkRow[] {
  return list.map((ai, key) => ({
    key,
    include: true,
    tipo: ai.tipo,
    amount: ai.monto,
    category: ai.tipo === 'gasto' ? (categories.includes(ai.categoria) ? ai.categoria : 'Otros') : 'Otros',
    fuente: ai.tipo === 'ingreso' ? (ai.fuente ?? 'otro') : null,
    description: ai.descripcion.slice(0, 120),
    date: ISO_DATE.test(ai.fecha) ? ai.fecha : today,
  }));
}

export function rowIsValid(row: BulkRow): boolean {
  return row.amount !== null && row.amount > 0 && ISO_DATE.test(row.date);
}

export function selectedRows(rows: readonly BulkRow[]): BulkRow[] {
  return rows.filter((row) => row.include);
}

export function bulkReady(rows: readonly BulkRow[]): boolean {
  const selected = selectedRows(rows);
  return selected.length > 0 && selected.every(rowIsValid);
}

/** Total con signo: los ingresos suman y el resto resta, como en el resumen del mes. */
export function bulkTotal(rows: readonly BulkRow[]): number {
  return selectedRows(rows).reduce((sum, row) => sum + (row.tipo === 'ingreso' ? 1 : -1) * (row.amount ?? 0), 0);
}

export function bulkInputs(rows: readonly BulkRow[]): MovementInput[] {
  return selectedRows(rows).map((row) => ({
    tipo: row.tipo,
    amount: Number(row.amount),
    category: row.tipo === 'gasto' ? row.category : 'Otros',
    fuente: row.tipo === 'ingreso' ? (row.fuente ?? 'otro') : null,
    description: row.description.trim(),
    date: row.date,
    is_private: false,
  }));
}
