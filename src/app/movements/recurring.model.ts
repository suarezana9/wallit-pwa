import type { Recurrente } from '../core/database.types';
import type { MovementInput } from './movement.model';

/** Mes en formato 'YYYY-MM' de una fecha ISO. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Fecha del movimiento fijo en un mes: su día, o el último del mes si ese día no existe. */
export function dateInMonth(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(Math.max(day, 1), last)).padStart(2, '0')}`;
}

/**
 * Fijos que faltan confirmar en un mes: activos, que ya habían empezado, que no se saltearon
 * y que todavía no tienen su movimiento ese mes.
 */
export function pendingFor(
  list: readonly Recurrente[],
  month: string,
  registered: ReadonlySet<string>,
  groupId: string | null,
): Recurrente[] {
  return list
    .filter((r) => r.group_id === groupId && r.activo && r.desde <= month && !r.saltados.includes(month) && !registered.has(r.id))
    .sort((a, b) => a.dia - b.dia || a.description.localeCompare(b.description));
}

export function recurringToInput(r: Recurrente, month: string, amount = Number(r.amount)): MovementInput {
  return {
    tipo: r.tipo,
    amount,
    category: r.tipo === 'gasto' ? r.category : 'Otros',
    fuente: r.tipo === 'ingreso' ? r.fuente : null,
    description: r.description,
    date: dateInMonth(month, r.dia),
    is_private: false,
    medio_pago: r.tipo === 'gasto' ? r.medio_pago : null,
    group_id: r.group_id,
    division: r.division,
    recurrente_id: r.id,
  };
}

/** Lo que se guarda como fijo a partir de un movimiento nuevo marcado "todos los meses". */
export function recurringFrom(input: MovementInput): Omit<Recurrente, 'id' | 'user_id' | 'created_at'> {
  return {
    group_id: input.group_id ?? null,
    tipo: input.tipo === 'pago_tarjeta' ? 'gasto' : input.tipo,
    amount: input.amount,
    category: input.category,
    fuente: input.fuente,
    description: input.description,
    medio_pago: input.medio_pago ?? null,
    division: input.division ?? null,
    dia: Number(input.date.slice(8, 10)),
    desde: monthOf(input.date),
    activo: true,
    saltados: [],
  };
}
