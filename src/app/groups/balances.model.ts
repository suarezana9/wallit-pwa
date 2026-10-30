import type { Division, Movimiento, Pago } from '../core/database.types';

/** Todo se calcula en centavos (enteros) para que la suma de las partes dé exacto el total. */
const toCents = (amount: number) => Math.round(Number(amount) * 100);
const fromCents = (cents: number) => cents / 100;

export function payerOf(movement: Pick<Movimiento, 'paid_by' | 'user_id'>): string {
  return movement.paid_by ?? movement.user_id;
}

/**
 * Reparte un monto en partes iguales. Los centavos que sobran van a los primeros,
 * así $100 entre 3 queda 33,34 + 33,33 + 33,33 y no se pierde ni sobra plata.
 */
export function equalShares(amount: number, userIds: readonly string[]): Record<string, number> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return {};
  const total = toCents(amount);
  const base = Math.floor(total / ids.length);
  const rest = total - base * ids.length;
  return Object.fromEntries(ids.map((id, i) => [id, fromCents(base + (i < rest ? 1 : 0))]));
}

/** Cuánto le toca a cada uno de un gasto. null = el gasto no está dividido. */
export function sharesOf(amount: number, division: Division | null): Record<string, number> | null {
  if (!division) return null;
  if (division.tipo === 'iguales') return division.entre.length ? equalShares(amount, division.entre) : null;
  const entries = Object.entries(division.partes).filter(([, value]) => Number(value) > 0);
  return entries.length ? Object.fromEntries(entries.map(([id, value]) => [id, Number(value)])) : null;
}

/** Diferencia entre el total y la suma de las partes (0 = cierra). Se usa para validar la división por montos. */
export function divisionGap(amount: number, division: Division | null): number {
  const shares = sharesOf(amount, division);
  if (!shares) return toCents(amount) / 100;
  const sum = Object.values(shares).reduce((acc, value) => acc + toCents(value), 0);
  return fromCents(toCents(amount) - sum);
}

/** Una división es válida si incluye a alguien y, por montos, si las partes suman el total. */
export function divisionIsValid(amount: number, division: Division | null): boolean {
  if (!division) return true;
  if (division.tipo === 'iguales') return division.entre.length > 0;
  return Object.values(division.partes).some((v) => v > 0) && divisionGap(amount, division) === 0;
}

/** Movimientos que cuentan para los saldos: gastos de grupo, no privados y con división. */
export function isSplittable(movement: Movimiento): boolean {
  return movement.tipo === 'gasto' && !movement.is_private && movement.division !== null;
}

export interface Balance {
  userId: string;
  /** Positivo: le deben. Negativo: debe. */
  net: number;
  paid: number;
  share: number;
}

/**
 * Saldo de cada persona: lo que pagó menos lo que le tocaba, más/menos los pagos entre miembros.
 * La suma de todos los saldos siempre da 0.
 */
export function computeBalances(
  movements: readonly Movimiento[],
  payments: readonly Pick<Pago, 'from_user' | 'to_user' | 'amount'>[],
  memberIds: readonly string[] = [],
): Balance[] {
  const acc = new Map<string, { net: number; paid: number; share: number }>();
  const get = (id: string) => {
    let entry = acc.get(id);
    if (!entry) {
      entry = { net: 0, paid: 0, share: 0 };
      acc.set(id, entry);
    }
    return entry;
  };
  memberIds.forEach(get);

  for (const movement of movements) {
    if (!isSplittable(movement)) continue;
    const shares = sharesOf(Number(movement.amount), movement.division);
    if (!shares) continue;
    const payer = get(payerOf(movement));
    payer.net += toCents(movement.amount);
    payer.paid += toCents(movement.amount);
    for (const [id, value] of Object.entries(shares)) {
      const person = get(id);
      person.net -= toCents(value);
      person.share += toCents(value);
    }
  }

  // Si A le paga a B, A "puso" plata (sube su saldo) y B la recibió (baja el suyo).
  for (const payment of payments) {
    get(payment.from_user).net += toCents(payment.amount);
    get(payment.to_user).net -= toCents(payment.amount);
  }

  return [...acc.entries()]
    .map(([userId, v]) => ({ userId, net: fromCents(v.net), paid: fromCents(v.paid), share: fromCents(v.share) }))
    .sort((a, b) => b.net - a.net);
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/**
 * Cómo saldar las cuentas con pocas transferencias: el que más debe le paga al que más le deben,
 * y se repite. Con n personas quedan como mucho n − 1 transferencias.
 */
export function settleUp(balances: readonly Pick<Balance, 'userId' | 'net'>[]): Transfer[] {
  const debtors = balances.filter((b) => toCents(b.net) < 0).map((b) => ({ id: b.userId, cents: -toCents(b.net) }));
  const creditors = balances.filter((b) => toCents(b.net) > 0).map((b) => ({ id: b.userId, cents: toCents(b.net) }));
  debtors.sort((a, b) => b.cents - a.cents);
  creditors.sort((a, b) => b.cents - a.cents);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const cents = Math.min(debtors[i].cents, creditors[j].cents);
    if (cents > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: fromCents(cents) });
    debtors[i].cents -= cents;
    creditors[j].cents -= cents;
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }
  return transfers;
}

/** División por defecto de un gasto nuevo de grupo: partes iguales entre todos los miembros. */
export function defaultDivision(memberIds: readonly string[]): Division | null {
  return memberIds.length ? { tipo: 'iguales', entre: [...memberIds] } : null;
}
