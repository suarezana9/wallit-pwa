import { Service, computed, inject, resource, signal } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { Supabase } from '../core/supabase';
import { isInRange, monthRange } from '../core/dates';
import type { Movimiento } from '../core/database.types';
import { MovementInput, sortMovements, summarize } from './movement.model';

@Service()
export class MovementsStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);

  readonly monthOffset = signal(0);
  readonly range = computed(() => monthRange(this.monthOffset()));

  readonly movements = resource({
    params: () => {
      const userId = this.auth.user()?.id;
      if (!userId) return undefined;
      const { from, to } = this.range();
      return { userId, from, to };
    },
    loader: async ({ params }): Promise<Movimiento[]> => {
      const { data, error } = await this.supabase
        .from('expenses')
        .select('*')
        .eq('user_id', params.userId)
        .is('group_id', null)
        .gte('date', params.from)
        .lte('date', params.to)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  readonly list = computed(() => (this.movements.hasValue() ? this.movements.value() : []));
  readonly summary = computed(() => summarize(this.list()));

  previousMonth(): void {
    this.monthOffset.update((o) => o - 1);
  }

  nextMonth(): void {
    this.monthOffset.update((o) => Math.min(o + 1, 0));
  }

  async create(input: MovementInput): Promise<string | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return 'Tu sesión expiró. Volvé a ingresar.';
    const { data, error } = await this.supabase
      .from('expenses')
      .insert({ ...input, user_id: userId, group_id: null, is_private: false, receipt_url: null })
      .select()
      .single();
    if (error) return 'No se pudo guardar el movimiento.';
    if (isInRange(data.date, this.range())) {
      this.movements.update((list) => sortMovements([...(list ?? []), data]));
    }
    return null;
  }

  async update(id: string, input: MovementInput): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('expenses')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) return 'No se pudieron guardar los cambios.';
    this.movements.update((list) => {
      const rest = (list ?? []).filter((m) => m.id !== id);
      return sortMovements(isInRange(data.date, this.range()) ? [...rest, data] : rest);
    });
    return null;
  }

  async remove(id: string): Promise<string | null> {
    const { error } = await this.supabase.from('expenses').delete().eq('id', id);
    if (error) return 'No se pudo eliminar el movimiento.';
    this.movements.update((list) => (list ?? []).filter((m) => m.id !== id));
    return null;
  }
}
