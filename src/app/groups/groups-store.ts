import { Service, computed, effect, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../core/auth-store';
import { Supabase } from '../core/supabase';
import { monthRange } from '../core/dates';
import { I18n } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import type { Grupo, RolGrupo } from '../core/database.types';

export const PERSONAL = 'personal';

/**
 * Cambia el espacio activo. Si se está viendo el detalle de un grupo, navega al espacio elegido
 * para que la página no quede mostrando el grupo anterior.
 */
export function injectSpaceSwitcher(): (id: string) => void {
  const groups = inject(GroupsStore);
  const router = inject(Router);
  return (id: string) => {
    groups.setContext(id);
    if (/^\/grupos\/[^/?]+/.test(router.url)) {
      void router.navigateByUrl(id === PERSONAL ? '/inicio' : `/grupos/${id}`);
    }
  };
}

export interface GroupWithRole {
  group: Grupo;
  role: RolGrupo;
}

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  role: RolGrupo;
  joinedAt: string;
}

export interface GroupMonthSummary {
  gastos: number;
  ingresos: number;
  count: number;
}

const CONTEXT_KEY = 'wallit_contexto';

function readContext(): string {
  try {
    return localStorage.getItem(CONTEXT_KEY) ?? PERSONAL;
  } catch {
    return PERSONAL;
  }
}

@Service()
export class GroupsStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);

  private readonly selected = signal(readContext());

  readonly groups = resource({
    params: () => this.auth.user()?.id,
    loader: async ({ params: userId }): Promise<GroupWithRole[]> => {
      const { data: memberships, error } = await this.supabase
        .from('group_members')
        .select('group_id, role, joined_at')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      if (!memberships.length) return [];
      const { data: groups, error: groupsError } = await this.supabase
        .from('groups')
        .select('*')
        .in('id', memberships.map((m) => m.group_id));
      if (groupsError) throw groupsError;
      return memberships
        .map((m) => ({ group: groups.find((g) => g.id === m.group_id), role: m.role }))
        .filter((g): g is GroupWithRole => !!g.group);
    },
  });

  readonly list = computed(() => (this.groups.hasValue() ? this.groups.value() : []));

  readonly contextId = computed(() => {
    const id = this.selected();
    if (id === PERSONAL || !this.groups.hasValue()) return id;
    return this.list().some((g) => g.group.id === id) ? id : PERSONAL;
  });

  readonly active = computed(() => this.list().find((g) => g.group.id === this.contextId()) ?? null);
  readonly activeGroupId = computed(() => (this.contextId() === PERSONAL ? null : this.contextId()));

  readonly activeMembers = resource({
    params: () => this.activeGroupId() ?? undefined,
    loader: ({ params: groupId }) => this.fetchMembers(groupId),
  });

  readonly memberNames = computed<Record<string, string>>(() => {
    const members = this.activeMembers.hasValue() ? this.activeMembers.value() : [];
    return Object.fromEntries(members.map((m) => [m.userId, m.name]));
  });

  readonly summaries = resource({
    params: () => {
      const ids = this.list().map((g) => g.group.id);
      return ids.length ? { ids, ...monthRange(0) } : undefined;
    },
    loader: async ({ params }): Promise<Record<string, GroupMonthSummary>> => {
      const { data, error } = await this.supabase
        .from('expenses')
        .select('group_id, amount, tipo')
        .in('group_id', params.ids)
        .gte('date', params.from)
        .lte('date', params.to);
      if (error) throw error;
      const result: Record<string, GroupMonthSummary> = {};
      for (const id of params.ids) result[id] = { gastos: 0, ingresos: 0, count: 0 };
      for (const row of data) {
        const summary = row.group_id ? result[row.group_id] : undefined;
        if (!summary) continue;
        summary.count++;
        if (row.tipo === 'gasto') summary.gastos += Number(row.amount);
        if (row.tipo === 'ingreso') summary.ingresos += Number(row.amount);
      }
      return result;
    },
  });

  constructor() {
    effect(() => {
      const id = this.contextId();
      try {
        localStorage.setItem(CONTEXT_KEY, id);
      } catch {
        return;
      }
    });
  }

  setContext(id: string): void {
    this.selected.set(id);
  }

  roleIn(groupId: string): RolGrupo | null {
    return this.list().find((g) => g.group.id === groupId)?.role ?? null;
  }

  async fetchMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await this.supabase.rpc('obtener_miembros_grupo', { p_group_id: groupId });
    if (error) throw error;
    return (data ?? []).map((m) => ({
      userId: m.user_id,
      name: m.name || m.email?.split('@')[0] || '—',
      email: m.email ?? '',
      role: m.role,
      joinedAt: m.joined_at,
    }));
  }

  async create(name: string): Promise<{ id?: string; error?: string }> {
    const userId = this.auth.user()?.id;
    if (!userId) return { error: this.i18n.t('errSessionExpired') };
    const { error } = await this.supabase
      .from('groups')
      .insert({ name: name.trim(), created_by: userId, currency: this.preferences.currency() });
    if (error) return { error: this.i18n.t('errCreateGroup') };

    const { data: group, error: findError } = await this.supabase
      .from('groups')
      .select('id')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (findError || !group) return { error: this.i18n.t('errCreateGroup') };

    const { error: memberError } = await this.supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId, role: 'admin' });
    if (memberError) return { error: this.i18n.t('errCreateGroup') };

    this.groups.reload();
    return { id: group.id };
  }

  async findByCode(code: string): Promise<{ id: string; name: string } | null> {
    const { data, error } = await this.supabase.rpc('buscar_grupo_por_codigo', { p_codigo: code.trim() });
    if (error || !data?.[0]) return null;
    return { id: data[0].id, name: data[0].name };
  }

  async join(code: string): Promise<{ id?: string; error?: string }> {
    const userId = this.auth.user()?.id;
    if (!userId) return { error: this.i18n.t('errSessionExpired') };
    const group = await this.findByCode(code);
    if (!group) return { error: this.i18n.t('errInvalidCode') };
    if (this.list().some((g) => g.group.id === group.id)) return { error: this.i18n.t('errAlreadyMember') };

    const { error } = await this.supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId, role: 'member' });
    if (error) return { error: this.i18n.t('errJoinGroup') };

    this.groups.reload();
    return { id: group.id };
  }

  async rename(groupId: string, name: string): Promise<string | null> {
    if (this.roleIn(groupId) !== 'admin') return this.i18n.t('errOnlyAdmin');
    const { error } = await this.supabase.from('groups').update({ name: name.trim() }).eq('id', groupId);
    if (error) return this.i18n.t('errSaveChanges');
    this.groups.update((list) =>
      (list ?? []).map((g) => (g.group.id === groupId ? { ...g, group: { ...g.group, name: name.trim() } } : g)),
    );
    return null;
  }

  async leave(groupId: string): Promise<string | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return this.i18n.t('errSessionExpired');
    const { error } = await this.supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
    if (error) return this.i18n.t('errLeaveGroup');
    this.forget(groupId);
    return null;
  }

  async close(groupId: string): Promise<string | null> {
    if (this.roleIn(groupId) !== 'admin') return this.i18n.t('errOnlyAdmin');
    const { error } = await this.supabase.from('group_members').delete().eq('group_id', groupId);
    if (error) return this.i18n.t('errLeaveGroup');
    this.forget(groupId);
    return null;
  }

  private forget(groupId: string): void {
    if (this.selected() === groupId) this.selected.set(PERSONAL);
    this.groups.update((list) => (list ?? []).filter((g) => g.group.id !== groupId));
  }
}
