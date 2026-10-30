import { Service, computed, effect, inject, resource, signal } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { Supabase } from '../core/supabase';
import { isInRange, monthLabel, monthRange } from '../core/dates';
import { I18n } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import type { Movimiento } from '../core/database.types';
import { GroupsStore } from '../groups/groups-store';
import { ReceiptsService } from '../receipts/receipts.service';
import { MovementInput, sortMovements, summarize } from './movement.model';

@Service()
export class MovementsStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);
  private readonly groups = inject(GroupsStore);
  private readonly receipts = inject(ReceiptsService);

  readonly monthOffset = signal(0);
  readonly range = computed(() => monthRange(this.monthOffset()));
  readonly label = computed(() => monthLabel(this.monthOffset(), this.preferences.locale()));

  readonly movements = resource({
    params: () => {
      const userId = this.auth.user()?.id;
      if (!userId) return undefined;
      const { from, to } = this.range();
      return { userId, groupId: this.groups.activeGroupId(), from, to };
    },
    loader: async ({ params }): Promise<Movimiento[]> => {
      const base = this.supabase.from('expenses').select('*');
      const scoped = params.groupId
        ? base.eq('group_id', params.groupId)
        : base.eq('user_id', params.userId).is('group_id', null);
      const { data, error } = await scoped
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

  constructor() {
    effect((onCleanup) => {
      const groupId = this.groups.activeGroupId();
      if (!groupId) return;
      const channel = this.supabase
        .channel(`expenses-${groupId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, () =>
          this.movements.reload(),
        )
        .subscribe();
      onCleanup(() => void this.supabase.removeChannel(channel));
    });
  }

  previousMonth(): void {
    this.monthOffset.update((o) => o - 1);
  }

  nextMonth(): void {
    this.monthOffset.update((o) => Math.min(o + 1, 0));
  }

  async create(input: MovementInput): Promise<string | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return this.i18n.t('errSessionExpired');
    const { data, error } = await this.supabase.from('expenses').insert(this.toRow(input, userId)).select().single();
    if (error) return this.i18n.t('errSave');
    this.addToList([data]);
    return null;
  }

  /** Alta de varios movimientos en un solo insert (los que la IA encontró en un mismo audio o texto). */
  async createMany(inputs: readonly MovementInput[]): Promise<string | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return this.i18n.t('errSessionExpired');
    if (!inputs.length) return null;
    const { data, error } = await this.supabase
      .from('expenses')
      .insert(inputs.map((input) => this.toRow(input, userId)))
      .select();
    if (error) return this.i18n.t('errSave');
    this.addToList(data);
    return null;
  }

  private toRow(input: MovementInput, userId: string) {
    const groupId = input.group_id !== undefined ? input.group_id : this.groups.activeGroupId();
    const isGroupExpense = !!groupId && input.tipo === 'gasto';
    return {
      ...input,
      user_id: userId,
      group_id: groupId,
      is_private: groupId ? input.is_private : false,
      receipt_url: input.receipt_url ?? null,
      paid_by: groupId && input.paid_by && input.paid_by !== userId ? input.paid_by : null,
      division: isGroupExpense ? (input.division ?? null) : null,
    };
  }

  /** Solo se suman a la lista los que son del espacio activo y del mes que se está viendo. */
  private addToList(rows: readonly Movimiento[]): void {
    const active = this.groups.activeGroupId();
    const visible = rows.filter((row) => row.group_id === active && isInRange(row.date, this.range()));
    if (visible.length) this.movements.update((list) => sortMovements([...(list ?? []), ...visible]));
  }

  async update(id: string, input: MovementInput): Promise<string | null> {
    // Editar no cambia el espacio de un movimiento.
    const changes = { ...input };
    delete changes.group_id;
    const { data, error } = await this.supabase
      .from('expenses')
      .update(changes)
      .eq('id', id)
      .select()
      .single();
    if (error) return this.i18n.t('errSaveChanges');
    this.movements.update((list) => {
      const rest = (list ?? []).filter((m) => m.id !== id);
      const inScope = data.group_id === this.groups.activeGroupId() && isInRange(data.date, this.range());
      return sortMovements(inScope ? [...rest, data] : rest);
    });
    return null;
  }

  async remove(id: string): Promise<string | null> {
    const { data, error } = await this.supabase.from('expenses').delete().eq('id', id).select('receipt_url');
    if (error) return this.i18n.t('errDelete');
    for (const row of data ?? []) void this.receipts.remove(row.receipt_url);
    this.movements.update((list) => (list ?? []).filter((m) => m.id !== id));
    return null;
  }
}
