// Lógica pura de las notificaciones: a quién avisar y qué decir. Sin Deno ni Supabase, para testear aparte.
// Los saldos repiten las reglas de src/app/groups/balances.model.ts (centavos, división y saldar con pocas transferencias).

export type Pref = 'gasto_grupo' | 'pagos' | 'presupuesto' | 'deudas';

export interface Message {
  title: string;
  body: string;
  /** Ruta de la app que se abre al tocar la notificación. */
  url: string;
  /** Agrupa notificaciones del mismo tema: una nueva reemplaza a la anterior. */
  tag: string;
}

export interface Delivery {
  userIds: string[];
  pref: Pref;
  message: Message;
}

const PREF_DEFAULTS: Record<Pref, boolean> = { gasto_grupo: true, pagos: true, presupuesto: true, deudas: true };

/** notif_config es compartido con la app móvil: si una clave no está, vale el default (activada). */
export function wants(config: unknown, pref: Pref): boolean {
  const value = config && typeof config === 'object' ? (config as Record<string, unknown>)[pref] : undefined;
  return typeof value === 'boolean' ? value : PREF_DEFAULTS[pref];
}

export function formatMoney(amount: number, currency = 'ARS'): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount).replace(/\u00a0/g, ' ');
  } catch {
    return `$${amount}`;
  }
}

// ---------- Actividad de grupo ----------

export interface ActivityInput {
  kind: string;
  actor: string | null;
  data: { actor_name?: string; descripcion?: string; categoria?: string; tipo?: string; monto?: number | string; de?: string; para?: string };
  group: { id: string; name: string; currency: string };
  memberIds: string[];
  names: Record<string, string>;
}

export function activityDeliveries(input: ActivityInput): Delivery[] {
  const { kind, actor, data, group, memberIds, names } = input;
  const actorName = (actor && names[actor]) || data.actor_name || 'Alguien';
  const others = memberIds.filter((id) => id !== actor);
  const url = `/grupos/${group.id}`;
  const amount = data.monto != null ? formatMoney(Number(data.monto), group.currency) : '';

  if (kind === 'gasto_nuevo') {
    const what = data.descripcion?.trim() || data.categoria || 'un gasto';
    const income = data.tipo && data.tipo !== 'gasto';
    return [{
      userIds: others,
      pref: 'gasto_grupo',
      message: {
        title: `${income ? '💰' : '💸'} ${group.name}`,
        body: `${actorName} cargó ${what}${amount ? ` · ${amount}` : ''}`,
        url,
        tag: `actividad-${group.id}`,
      },
    }];
  }

  if (kind === 'pago' && data.de && data.para) {
    const deliveries: Delivery[] = [];
    // A quien recibe: "Luigi te pagó". A quien paga (si lo registró el otro): "Ana registró que le pagaste".
    if (data.para !== actor) {
      deliveries.push({
        userIds: [data.para],
        pref: 'pagos',
        message: {
          title: `🤝 ${group.name}`,
          body: `${names[data.de] ?? 'Alguien'} te pagó ${amount}`,
          url,
          tag: `pago-${group.id}`,
        },
      });
    }
    if (data.de !== actor) {
      deliveries.push({
        userIds: [data.de],
        pref: 'pagos',
        message: {
          title: `🤝 ${group.name}`,
          body: `${actorName} registró que le pagaste ${amount}`,
          url,
          tag: `pago-${group.id}`,
        },
      });
    }
    return deliveries;
  }

  if (kind === 'miembro_entro') {
    return [{
      userIds: others,
      pref: 'gasto_grupo',
      message: { title: `👥 ${group.name}`, body: `${actorName} se sumó al grupo`, url, tag: `miembros-${group.id}` },
    }];
  }

  return [];
}

// ---------- Presupuestos ----------

export const THRESHOLDS = [80, 100] as const;

export function reachedThresholds(spent: number, limit: number): number[] {
  if (limit <= 0) return [];
  const percent = (spent / limit) * 100;
  return THRESHOLDS.filter((t) => percent >= t);
}

export function budgetMessage(budget: { id: string; name: string }, percent: number, threshold: number, groupName: string | null): Message {
  const where = groupName ? ` · ${groupName}` : '';
  const rounded = Math.round(percent);
  return threshold >= 100
    ? {
        title: `🚨 Te pasaste en ${budget.name}${where}`,
        body: `Ya van ${rounded}% del presupuesto de este mes.`,
        url: '/presupuestos',
        tag: `presupuesto-${budget.id}`,
      }
    : {
        title: `⚠️ ${budget.name}: ${rounded}% usado${where}`,
        body: `Te queda ${Math.max(0, 100 - rounded)}% del presupuesto para el resto del mes.`,
        url: '/presupuestos',
        tag: `presupuesto-${budget.id}`,
      };
}

// ---------- Saldos y recordatorio de deudas ----------

type Division = { tipo: 'iguales'; entre: string[] } | { tipo: 'montos'; partes: Record<string, number> };

export interface ExpenseRow {
  amount: number | string;
  user_id: string;
  paid_by: string | null;
  division: Division | null;
  is_private: boolean;
  tipo: string;
}

export interface PaymentRow {
  from_user: string;
  to_user: string;
  amount: number | string;
}

const cents = (value: number | string) => Math.round(Number(value) * 100);

function shares(amount: number | string, division: Division | null): Record<string, number> | null {
  if (!division) return null;
  if (division.tipo === 'iguales') {
    const ids = [...new Set(division.entre)];
    if (!ids.length) return null;
    const total = cents(amount);
    const base = Math.floor(total / ids.length);
    const rest = total - base * ids.length;
    return Object.fromEntries(ids.map((id, i) => [id, base + (i < rest ? 1 : 0)]));
  }
  const entries = Object.entries(division.partes).filter(([, v]) => Number(v) > 0);
  return entries.length ? Object.fromEntries(entries.map(([id, v]) => [id, cents(v)])) : null;
}

/** Saldo neto en centavos por persona (positivo: le deben). */
export function netBalances(expenses: readonly ExpenseRow[], payments: readonly PaymentRow[]): Map<string, number> {
  const net = new Map<string, number>();
  const add = (id: string, value: number) => net.set(id, (net.get(id) ?? 0) + value);
  for (const e of expenses) {
    if (e.tipo !== 'gasto' || e.is_private) continue;
    const parts = shares(e.amount, e.division);
    if (!parts) continue;
    add(e.paid_by ?? e.user_id, cents(e.amount));
    for (const [id, value] of Object.entries(parts)) add(id, -value);
  }
  for (const p of payments) {
    add(p.from_user, cents(p.amount));
    add(p.to_user, -cents(p.amount));
  }
  return net;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export function settleUp(net: Map<string, number>): Transfer[] {
  const debtors = [...net].filter(([, v]) => v < 0).map(([id, v]) => ({ id, c: -v })).sort((a, b) => b.c - a.c);
  const creditors = [...net].filter(([, v]) => v > 0).map(([id, v]) => ({ id, c: v })).sort((a, b) => b.c - a.c);
  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const c = Math.min(debtors[i].c, creditors[j].c);
    if (c > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: c / 100 });
    debtors[i].c -= c;
    creditors[j].c -= c;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }
  return transfers;
}

/** Un mensaje por persona que debe en el grupo: "Le debés $X a Ana" o "Debés $X en total (a Ana y Luigi)". */
export function debtDeliveries(
  group: { id: string; name: string; currency: string },
  transfers: readonly Transfer[],
  names: Record<string, string>,
): Delivery[] {
  const byDebtor = new Map<string, Transfer[]>();
  for (const t of transfers) byDebtor.set(t.from, [...(byDebtor.get(t.from) ?? []), t]);
  return [...byDebtor].map(([debtor, list]) => {
    const total = list.reduce((sum, t) => sum + t.amount, 0);
    const creditors = list.map((t) => names[t.to] ?? 'alguien');
    const body = list.length === 1
      ? `Le debés ${formatMoney(total, group.currency)} a ${creditors[0]}.`
      : `Debés ${formatMoney(total, group.currency)} en total (a ${creditors.slice(0, -1).join(', ')} y ${creditors.at(-1)}).`;
    return {
      userIds: [debtor],
      pref: 'deudas' as const,
      message: { title: `🧾 Cuentas pendientes en ${group.name}`, body, url: `/grupos/${group.id}`, tag: `deudas-${group.id}` },
    };
  });
}

/** Lo que espera el service worker de Angular (ngsw) para mostrar la notificación y abrir la URL al tocarla. */
export function ngswPayload(message: Message): string {
  return JSON.stringify({
    notification: {
      title: message.title,
      body: message.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: message.tag,
      renotify: true,
      data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: message.url } } },
    },
  });
}
