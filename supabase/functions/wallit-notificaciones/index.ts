// Edge Function "wallit-notificaciones": la llaman triggers de la base (pg_net) y pg_cron, nunca el navegador.
// Manda Web Push (la PWA) y Expo (la app móvil) según las preferencias de cada persona.
//
// Secretos que necesita (Supabase > Edge Functions > Secrets):
//   WEBHOOK_SECRET     el mismo valor guardado en Vault como 'wallit_webhook_secret'
//   VAPID_PUBLIC_KEY   clave pública Web Push (también va en environment.ts)
//   VAPID_PRIVATE_KEY  clave privada Web Push (solo acá)
//   VAPID_SUBJECT      mailto:tu@email.com
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {
  activityDeliveries, budgetMessage, debtDeliveries, netBalances, ngswPayload, reachedThresholds, settleUp, wants,
  type Delivery, type ExpenseRow, type PaymentRow,
} from './logic.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function serviceKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    const first = Object.values(keys)[0];
    if (first) return first;
  } catch {
    // sigue con el nombre clásico
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Comparación en tiempo constante para que no se pueda adivinar el secreto midiendo tiempos. */
function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function namesOf(db: SupabaseClient, ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await db.from('users').select('id, name, email').in('id', ids);
  return Object.fromEntries((data ?? []).map((u) => [u.id, u.name || String(u.email ?? '').split('@')[0] || 'Alguien']));
}

async function memberIdsOf(db: SupabaseClient, groupId: string): Promise<string[]> {
  const { data } = await db.from('group_members').select('user_id').eq('group_id', groupId);
  return (data ?? []).map((m) => m.user_id as string);
}

/** Manda cada entrega a quien la quiera recibir: Web Push a sus navegadores y Expo a su celular. */
async function deliver(db: SupabaseClient, deliveries: Delivery[]): Promise<{ web: number; expo: number }> {
  const userIds = [...new Set(deliveries.flatMap((d) => d.userIds))];
  if (!userIds.length) return { web: 0, expo: 0 };

  const [{ data: users }, { data: subs }] = await Promise.all([
    db.from('users').select('id, notif_config, push_token').in('id', userIds),
    db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds),
  ]);
  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));

  let web = 0;
  const expoMessages: unknown[] = [];
  const dead: string[] = [];
  const used: string[] = [];

  for (const delivery of deliveries) {
    const payload = ngswPayload(delivery.message);
    for (const userId of delivery.userIds) {
      const user = userById.get(userId);
      if (!user || !wants(user.notif_config, delivery.pref)) continue;

      for (const sub of (subs ?? []).filter((s) => s.user_id === userId)) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60 * 24, urgency: 'normal' },
          );
          web++;
          used.push(sub.id);
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410: el navegador dio de baja la suscripción; se borra para no reintentar siempre.
          if (status === 404 || status === 410) dead.push(sub.id);
          else console.error('web push', status, (error as Error).message);
        }
      }

      const token = user.push_token as string | null;
      if (token?.startsWith('ExponentPushToken')) {
        expoMessages.push({ to: token, title: delivery.message.title, body: delivery.message.body, sound: 'default' });
      }
    }
  }

  const pending: PromiseLike<unknown>[] = [];
  if (dead.length) pending.push(db.from('push_subscriptions').delete().in('id', dead));
  if (used.length) pending.push(db.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).in('id', used));
  if (expoMessages.length) {
    pending.push(
      fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(expoMessages),
      }).catch((error) => console.error('expo', error)),
    );
  }
  await Promise.all(pending);
  return { web, expo: expoMessages.length };
}

// ---------- Eventos ----------

async function onActivity(db: SupabaseClient, id: string): Promise<Delivery[]> {
  const { data: activity } = await db.from('group_activity').select('*').eq('id', id).single();
  if (!activity) return [];
  const { data: group } = await db.from('groups').select('id, name, currency').eq('id', activity.group_id).single();
  if (!group) return [];
  const memberIds = await memberIdsOf(db, group.id);
  const names = await namesOf(db, [...memberIds, activity.actor].filter(Boolean) as string[]);
  return activityDeliveries({ kind: activity.kind, actor: activity.actor, data: activity.data ?? {}, group, memberIds, names });
}

async function onBudget(db: SupabaseClient, expenseId: string): Promise<Delivery[]> {
  const { data: expense } = await db.from('expenses').select('*').eq('id', expenseId).single();
  if (!expense || expense.tipo !== 'gasto') return [];
  const month = String(expense.date).slice(0, 7);

  const scoped = db.from('budgets').select('*').eq('month', month).contains('categories', [expense.category]);
  const { data: budgets } = expense.group_id
    ? await scoped.eq('group_id', expense.group_id)
    : await scoped.eq('user_id', expense.user_id).is('group_id', null);
  if (!budgets?.length) return [];

  const [year, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
  const { data: group } = expense.group_id
    ? await db.from('groups').select('name').eq('id', expense.group_id).single()
    : { data: null };
  const recipients = expense.group_id ? await memberIdsOf(db, expense.group_id) : [expense.user_id as string];

  const deliveries: Delivery[] = [];
  for (const budget of budgets) {
    const base = db.from('expenses').select('amount').eq('tipo', 'gasto').gte('date', from).lte('date', to).in('category', budget.categories);
    const { data: rows } = expense.group_id
      ? await base.eq('group_id', expense.group_id).eq('is_private', false)
      : await base.eq('user_id', expense.user_id).is('group_id', null);
    const spent = (rows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    const limit = Number(budget.amount_limit);
    const reached = reachedThresholds(spent, limit);

    // Si bajó (se editó o borró un gasto), se olvidan los avisos de arriba para poder volver a avisar.
    await db.from('budget_alerts').delete().eq('budget_id', budget.id).not('umbral', 'in', `(${reached.join(',') || 0})`);
    if (!reached.length) continue;

    const { data: inserted } = await db
      .from('budget_alerts')
      .upsert(reached.map((umbral) => ({ budget_id: budget.id, umbral })), { onConflict: 'budget_id,umbral', ignoreDuplicates: true })
      .select('umbral');
    const fresh = (inserted ?? []).map((r) => r.umbral as number);
    if (!fresh.length) continue;

    deliveries.push({
      userIds: recipients,
      pref: 'presupuesto',
      message: budgetMessage(budget, (spent / limit) * 100, Math.max(...fresh), group?.name ?? null),
    });
  }
  return deliveries;
}

async function onDebts(db: SupabaseClient): Promise<Delivery[]> {
  const { data: groups } = await db.from('groups').select('id, name, currency');
  const deliveries: Delivery[] = [];
  for (const group of groups ?? []) {
    const [{ data: expenses }, { data: payments }] = await Promise.all([
      db.from('expenses').select('amount, user_id, paid_by, division, is_private, tipo').eq('group_id', group.id).eq('tipo', 'gasto').not('division', 'is', null),
      db.from('settlements').select('from_user, to_user, amount').eq('group_id', group.id),
    ]);
    const transfers = settleUp(netBalances((expenses ?? []) as ExpenseRow[], (payments ?? []) as PaymentRow[]));
    if (!transfers.length) continue;
    const names = await namesOf(db, [...new Set(transfers.flatMap((t) => [t.from, t.to]))]);
    deliveries.push(...debtDeliveries(group, transfers, names));
  }
  return deliveries;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!sameSecret(req.headers.get('x-wallit-secret') ?? '', Deno.env.get('WEBHOOK_SECRET') ?? '')) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  if (publicKey && privateKey) {
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@wallit.app', publicKey, privateKey);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), { auth: { persistSession: false } });

  try {
    const body = (await req.json()) as { tipo?: string; id?: string; expense_id?: string };
    let deliveries: Delivery[] = [];
    if (body.tipo === 'actividad' && body.id) deliveries = await onActivity(db, body.id);
    else if (body.tipo === 'presupuesto' && body.expense_id) deliveries = await onBudget(db, body.expense_id);
    else if (body.tipo === 'deudas') deliveries = await onDebts(db);
    else return json({ error: 'BAD_EVENT' }, 400);

    const sent = await deliver(db, deliveries);
    console.log('wallit-notificaciones', body.tipo, sent);
    return json({ ok: true, ...sent });
  } catch (error) {
    console.error(error);
    return json({ error: 'INTERNAL' }, 500);
  }
});
