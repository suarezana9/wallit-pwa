import type { Json } from '../core/database.types';

/** Un producto del ticket. excluido = "no era mío", no cuenta en lo que gastaste. */
export interface TicketItem {
  descripcion: string;
  monto: number;
  excluido: boolean;
}

/** Cómo se llega al monto del gasto: total del ticket − lo que no era tuyo − reintegros. Se guarda en expenses.detalle. */
export interface Detalle {
  total: number;
  items: TicketItem[];
  reintegro: number;
  reintegro_nota: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function excludedTotal(detalle: Detalle): number {
  return round2(detalle.items.filter((i) => i.excluido).reduce((sum, i) => sum + i.monto, 0));
}

/** Lo que realmente gastaste. Nunca negativo. */
export function netAmount(detalle: Detalle): number {
  return Math.max(0, round2(detalle.total - excludedTotal(detalle) - detalle.reintegro));
}

export function hasAdjustments(detalle: Detalle | null): boolean {
  return !!detalle && (detalle.reintegro > 0 || detalle.items.some((i) => i.excluido));
}

/** Si la persona cambió el monto a mano, el total del ticket se recalcula para que todo siga cerrando. */
export function withAmount(detalle: Detalle, amount: number): Detalle {
  if (netAmount(detalle) === round2(amount)) return detalle;
  return { ...detalle, total: round2(amount + excludedTotal(detalle) + detalle.reintegro) };
}

export function fromTicket(total: number | null, items: readonly { descripcion: string; monto: number }[] | undefined): Detalle | null {
  if (!items?.length || total === null) return null;
  return { total, items: items.map((i) => ({ ...i, excluido: false })), reintegro: 0, reintegro_nota: '' };
}

export function parseDetalle(raw: Json | null | undefined): Detalle | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const total = Number(raw['total']);
  if (!Number.isFinite(total)) return null;
  const items = Array.isArray(raw['items'])
    ? raw['items'].flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const monto = Number(item['monto']);
        const descripcion = typeof item['descripcion'] === 'string' ? item['descripcion'] : '';
        return descripcion && Number.isFinite(monto) ? [{ descripcion, monto, excluido: item['excluido'] === true }] : [];
      })
    : [];
  const reintegro = Number(raw['reintegro']);
  return {
    total,
    items,
    reintegro: Number.isFinite(reintegro) && reintegro > 0 ? reintegro : 0,
    reintegro_nota: typeof raw['reintegro_nota'] === 'string' ? raw['reintegro_nota'] : '',
  };
}

/** Solo se guarda si aporta algo (productos o ajustes); un gasto común queda con detalle null. */
export function toJson(detalle: Detalle | null): Json | null {
  if (!detalle || (!detalle.items.length && !hasAdjustments(detalle))) return null;
  return {
    total: detalle.total,
    items: detalle.items.map((i) => ({ descripcion: i.descripcion, monto: i.monto, excluido: i.excluido })),
    reintegro: detalle.reintegro,
    reintegro_nota: detalle.reintegro_nota.trim().slice(0, 40),
  };
}
