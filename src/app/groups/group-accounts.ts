import { computed, effect, inject, resource, untracked } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { I18n } from '../core/i18n/i18n';
import { Supabase } from '../core/supabase';
import type { Movimiento, Pago } from '../core/database.types';
import { MovementsStore } from '../movements/movements-store';
import { computeBalances, isSplittable, settleUp } from './balances.model';

export type GroupAccounts = ReturnType<typeof injectGroupAccounts>;

/**
 * Cuentas de un grupo: todos los gastos divididos (sin filtro de fechas, porque las deudas no vencen
 * con el mes) y los pagos entre miembros. Se actualiza solo con Realtime y cuando cambian los movimientos.
 * Es una función inject* y no un servicio porque cada pantalla puede mirar un grupo distinto.
 */
export function injectGroupAccounts(groupId: () => string | null, memberIds: () => readonly string[] = () => []) {
  const supabase = inject(Supabase).client;
  const auth = inject(AuthStore);
  const i18n = inject(I18n);
  const movementsStore = inject(MovementsStore);

  const data = resource({
    params: () => {
      const id = groupId();
      return id && auth.user() ? { id } : undefined;
    },
    loader: async ({ params }): Promise<{ movements: Movimiento[]; payments: Pago[] }> => {
      const [movements, payments] = await Promise.all([
        supabase.from('expenses').select('*').eq('group_id', params.id).eq('tipo', 'gasto'),
        supabase.from('settlements').select('*').eq('group_id', params.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
      ]);
      if (movements.error) throw movements.error;
      if (payments.error) throw payments.error;
      return { movements: movements.data, payments: payments.data };
    },
  });

  // Si cambian los movimientos que ve la app (alta, edición, baja), se recalculan los saldos aunque
  // Realtime no llegue. reload() conserva el valor anterior mientras carga, así no parpadea.
  let first = true;
  effect(() => {
    movementsStore.list();
    if (first) {
      first = false;
      return;
    }
    untracked(() => data.reload());
  });

  effect((onCleanup) => {
    const id = groupId();
    if (!id) return;
    const channel = supabase
      .channel(`cuentas-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${id}` }, () => data.reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${id}` }, () => data.reload())
      .subscribe();
    onCleanup(() => void supabase.removeChannel(channel));
  });

  const movements = computed(() => (data.hasValue() ? data.value().movements : []));
  const payments = computed(() => (data.hasValue() ? data.value().payments : []));
  const balances = computed(() => computeBalances(movements(), payments(), memberIds()));
  const transfers = computed(() => settleUp(balances()));
  const myBalance = computed(() => balances().find((b) => b.userId === auth.user()?.id)?.net ?? 0);
  /** Gastos de antes de esta versión: no tienen división y no cuentan para los saldos. */
  const unsplitCount = computed(() => movements().filter((m) => !m.is_private && !isSplittable(m)).length);

  async function registerPayment(from: string, to: string, amount: number): Promise<string | null> {
    const id = groupId();
    const userId = auth.user()?.id;
    if (!id || !userId) return i18n.t('errSessionExpired');
    const { data: row, error } = await supabase
      .from('settlements')
      .insert({ group_id: id, from_user: from, to_user: to, amount: Math.round(amount * 100) / 100, created_by: userId })
      .select()
      .single();
    if (error) return i18n.t('errSave');
    data.update((value) => (value ? { ...value, payments: [row, ...value.payments] } : value));
    return null;
  }

  async function removePayment(paymentId: string): Promise<string | null> {
    const { error } = await supabase.from('settlements').delete().eq('id', paymentId);
    if (error) return i18n.t('errDelete');
    data.update((value) => (value ? { ...value, payments: value.payments.filter((p) => p.id !== paymentId) } : value));
    return null;
  }

  return { data, movements, payments, balances, transfers, myBalance, unsplitCount, registerPayment, removePayment };
}
