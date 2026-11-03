import { Service, computed, inject, resource } from '@angular/core';
import { AuthStore } from './auth-store';
import { Supabase } from './supabase';
import { AvatarStorage } from '../shared/avatar-storage';
import type { UserRow } from './database.types';

export type Profile = Pick<UserRow, 'id' | 'name' | 'email' | 'avatar_url'> &
  Partial<Pick<UserRow, 'cobro_alias' | 'cobro_cuenta'>>;

/**
 * Perfil del usuario logueado, leído de la tabla public.users.
 * resource() vuelve a cargar solo cuando cambia el id del usuario (params),
 * y expone value(), isLoading() y error() como signals.
 */
@Service()
export class ProfileStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly avatars = inject(AvatarStorage);

  readonly profile = resource({
    params: () => this.auth.user()?.id,
    loader: async ({ params: userId }): Promise<Profile> => {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, name, email, avatar_url, cobro_alias, cobro_cuenta')
        .eq('id', userId)
        .single();
      if (!error) return data;
      // Sin la migración 019 las columnas de cobro no existen: se carga el perfil igual.
      const basic = await this.supabase.from('users').select('id, name, email, avatar_url').eq('id', userId).single();
      if (basic.error) throw basic.error;
      return basic.data;
    },
  });

  readonly payout = computed(() => {
    const p = this.profile.hasValue() ? this.profile.value() : null;
    return { alias: p?.cobro_alias ?? null, cuenta: p?.cobro_cuenta ?? null };
  });

  /** Guarda alias y cuenta (vacíos = null). Devuelve false si falló. */
  async savePayout(alias: string | null, cuenta: string | null): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    const changes = { cobro_alias: alias, cobro_cuenta: cuenta };
    const { error } = await this.supabase.from('users').update(changes).eq('id', userId);
    if (error) return false;
    this.profile.update((p) => (p ? { ...p, ...changes } : p));
    return true;
  }

  /** Foto de perfil guardada; mientras carga, la de la cuenta de Google (si entraste con Google). */
  readonly avatarUrl = computed(() => {
    if (this.profile.hasValue()) return this.profile.value()?.avatar_url ?? null;
    return (this.auth.user()?.user_metadata?.['avatar_url'] as string | undefined) ?? null;
  });

  /** Sube una foto nueva (se recorta cuadrada y se achica). Devuelve false si falló. */
  async setAvatar(file: Blob): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    try {
      const url = await this.avatars.upload(`users/${userId}`, file);
      return await this.saveAvatarUrl(userId, url);
    } catch (error) {
      console.warn('[avatar]', error);
      return false;
    }
  }

  async removeAvatar(): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    const ok = await this.saveAvatarUrl(userId, null);
    if (ok) await this.avatars.removeAll(`users/${userId}`).catch(() => undefined);
    return ok;
  }

  private async saveAvatarUrl(userId: string, url: string | null): Promise<boolean> {
    const { error } = await this.supabase.from('users').update({ avatar_url: url }).eq('id', userId);
    if (error) return false;
    this.profile.update((p) => (p ? { ...p, avatar_url: url } : p));
    return true;
  }

  /** Nombre a mostrar: el de la tabla users o, si todavía no cargó, el de la cuenta de Google o el email. */
  readonly displayName = computed(() => {
    const fromDb = this.profile.hasValue() ? this.profile.value()?.name : undefined;
    if (fromDb) return fromDb;
    const user = this.auth.user();
    const fromGoogle = user?.user_metadata?.['full_name'] as string | undefined;
    return fromGoogle ?? user?.email?.split('@')[0] ?? '';
  });
}
