import { Service, computed, inject, resource } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import type { Recurrente } from '../core/database.types';
import { I18n } from '../core/i18n/i18n';
import { Supabase } from '../core/supabase';
import { GroupsStore } from '../groups/groups-store';
import type { MovementInput } from './movement.model';
import { MovementsStore } from './movements-store';
import { monthOf, pendingFor, recurringFrom, recurringToInput } from './recurring.model';

/**
 * Gastos e ingresos fijos (alquiler, servicios, sueldo...). No se cargan solos: cada mes aparecen en Inicio
 * para confirmarlos (con el monto del mes, que en servicios cambia) o saltearlos.
 */
@Service()
export class RecurringStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18n);
  private readonly groups = inject(GroupsStore);
  private readonly movements = inject(MovementsStore);

  readonly all = resource({
    params: () => this.auth.user()?.id,
    loader: async ({ params: userId }): Promise<Recurrente[]> => {
      const { data, error } = await this.supabase
        .from('recurrentes')
        .select('*')
        .eq('user_id', userId)
        .order('dia', { ascending: true });
      // Si todavía no se corrió la migración 017, la app sigue andando sin fijos.
      if (error) return [];
      return data;
    },
  });

  readonly list = computed(() => (this.all.hasValue() ? this.all.value() : []));

  /** Mes que se está viendo en Inicio ('YYYY-MM'). */
  readonly month = computed(() => monthOf(this.movements.range().from));

  /** Fijos del espacio activo que faltan confirmar en el mes que estás mirando. */
  readonly pending = computed(() => {
    const registered = new Set(this.movements.list().map((m) => m.recurrente_id).filter((id): id is string => !!id));
    return pendingFor(this.list(), this.month(), registered, this.groups.activeGroupId());
  });

  /** Guarda un fijo nuevo a partir del movimiento que se está cargando. Devuelve su id. */
  async create(input: MovementInput): Promise<string | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;
    const { data, error } = await this.supabase
      .from('recurrentes')
      .insert({ ...recurringFrom(input), user_id: userId })
      .select()
      .single();
    if (error) return null;
    this.all.update((list) => [...(list ?? []), data]);
    return data.id;
  }

  /** Registra el movimiento del mes. Si el monto cambió, el fijo recuerda el nuevo para el mes que viene. */
  async confirm(recurrente: Recurrente, amount = Number(recurrente.amount)): Promise<string | null> {
    const error = await this.movements.create(recurringToInput(recurrente, this.month(), amount));
    if (error) return error;
    if (amount !== Number(recurrente.amount)) await this.update(recurrente.id, { amount });
    return null;
  }

  async confirmAll(list: readonly Recurrente[]): Promise<string | null> {
    return this.movements.createMany(list.map((r) => recurringToInput(r, this.month())));
  }

  skip(recurrente: Recurrente): Promise<string | null> {
    return this.update(recurrente.id, { saltados: [...recurrente.saltados, this.month()] });
  }

  async update(id: string, changes: Partial<Recurrente>): Promise<string | null> {
    const { data, error } = await this.supabase.from('recurrentes').update(changes).eq('id', id).select().single();
    if (error) return this.i18n.t('errSaveChanges');
    this.all.update((list) => (list ?? []).map((r) => (r.id === id ? data : r)));
    return null;
  }

  /** Borrar un fijo no borra los movimientos que ya generó. */
  async remove(id: string): Promise<string | null> {
    const { error } = await this.supabase.from('recurrentes').delete().eq('id', id);
    if (error) return this.i18n.t('errDelete');
    this.all.update((list) => (list ?? []).filter((r) => r.id !== id));
    return null;
  }
}
