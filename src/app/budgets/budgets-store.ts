import { Service, computed, inject, resource } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { I18n } from '../core/i18n/i18n';
import { Supabase } from '../core/supabase';
import { GroupsStore } from '../groups/groups-store';
import { MovementsStore } from '../movements/movements-store';
import { Budget, BudgetInput, BudgetProgress, monthKey, progressOf, spendingByCategory, totals } from './budget.model';

const UNIQUE_VIOLATION = '23505';

@Service()
export class BudgetsStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18n);
  private readonly groups = inject(GroupsStore);
  private readonly movements = inject(MovementsStore);

  readonly month = computed(() => monthKey(this.movements.monthOffset()));
  readonly previousMonth = computed(() => monthKey(this.movements.monthOffset() - 1));

  readonly budgets = resource({
    params: () => {
      const userId = this.auth.user()?.id;
      if (!userId) return undefined;
      return { userId, groupId: this.groups.activeGroupId(), month: this.month() };
    },
    loader: ({ params }) => this.fetch(params.userId, params.groupId, params.month),
  });

  readonly list = computed(() => (this.budgets.hasValue() ? this.budgets.value() : []));

  readonly byCategory = computed(() =>
    spendingByCategory(this.movements.list().filter((m) => m.tipo === 'gasto')),
  );

  readonly progress = computed<BudgetProgress[]>(() =>
    this.list()
      .map((b) => progressOf(b, this.byCategory()))
      .sort((a, b) => b.percent - a.percent),
  );

  readonly totals = computed(() => totals(this.progress()));

  readonly canEdit = computed(() => {
    const active = this.groups.active();
    return !active || active.role === 'admin';
  });

  reload(): void {
    this.budgets.reload();
  }

  async create(input: BudgetInput): Promise<string | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return this.i18n.t('errSessionExpired');
    const groupId = this.groups.activeGroupId();
    const { data, error } = await this.supabase
      .from('budgets')
      .insert({ ...this.clean(input), month: this.month(), user_id: groupId ? null : userId, group_id: groupId })
      .select()
      .single();
    if (error) return this.errorMessage(error.code, input.name);
    this.budgets.update((list) => [...(list ?? []), data]);
    return null;
  }

  async update(id: string, input: BudgetInput): Promise<string | null> {
    const { data, error } = await this.supabase.from('budgets').update(this.clean(input)).eq('id', id).select().single();
    if (error) return this.errorMessage(error.code, input.name);
    this.budgets.update((list) => (list ?? []).map((b) => (b.id === id ? data : b)));
    return null;
  }

  async remove(id: string): Promise<string | null> {
    const { error } = await this.supabase.from('budgets').delete().eq('id', id);
    if (error) return this.i18n.t('errDeleteBudget');
    this.budgets.update((list) => (list ?? []).filter((b) => b.id !== id));
    return null;
  }

  /** Copia los presupuestos del mes anterior al mes que se está viendo. Devuelve cuántos copió. */
  async copyFromPreviousMonth(): Promise<{ count: number; error?: string }> {
    const userId = this.auth.user()?.id;
    if (!userId) return { count: 0, error: this.i18n.t('errSessionExpired') };
    const groupId = this.groups.activeGroupId();
    const previous = await this.fetch(userId, groupId, this.previousMonth()).catch(() => null);
    if (!previous) return { count: 0, error: this.i18n.t('errSaveBudget') };
    const existing = new Set(this.list().map((b) => b.name.toLowerCase()));
    const rows = previous
      .filter((b) => !existing.has(b.name.toLowerCase()))
      .map((b) => ({
        name: b.name,
        amount_limit: b.amount_limit,
        categories: b.categories,
        month: this.month(),
        user_id: b.user_id,
        group_id: b.group_id,
      }));
    if (!rows.length) return { count: 0 };
    const { data, error } = await this.supabase.from('budgets').insert(rows).select();
    if (error) return { count: 0, error: this.i18n.t('errSaveBudget') };
    this.budgets.update((list) => [...(list ?? []), ...data]);
    return { count: data.length };
  }

  async hasPreviousMonthBudgets(): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    const previous = await this.fetch(userId, this.groups.activeGroupId(), this.previousMonth()).catch(() => []);
    return previous.length > 0;
  }

  private async fetch(userId: string, groupId: string | null, month: string): Promise<Budget[]> {
    const base = this.supabase.from('budgets').select('*').eq('month', month);
    const scoped = groupId ? base.eq('group_id', groupId) : base.eq('user_id', userId).is('group_id', null);
    const { data, error } = await scoped.order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  private clean(input: BudgetInput): BudgetInput {
    return { name: input.name.trim(), amount_limit: input.amount_limit, categories: [...input.categories] };
  }

  private errorMessage(code: string | undefined, name: string): string {
    return code === UNIQUE_VIOLATION ? this.i18n.t('errBudgetExists', name.trim()) : this.i18n.t('errSaveBudget');
  }
}
