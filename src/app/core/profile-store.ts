import { Service, computed, inject, resource } from '@angular/core';
import { AuthStore } from './auth-store';
import { Supabase } from './supabase';
import type { UserRow } from './database.types';

export type Profile = Pick<UserRow, 'id' | 'name' | 'email' | 'avatar_url'>;

/**
 * Perfil del usuario logueado, leído de la tabla public.users.
 * resource() vuelve a cargar solo cuando cambia el id del usuario (params),
 * y expone value(), isLoading() y error() como signals.
 */
@Service()
export class ProfileStore {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);

  readonly profile = resource({
    params: () => this.auth.user()?.id,
    loader: async ({ params: userId }): Promise<Profile> => {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  /** Nombre a mostrar: el de la tabla users o, si todavía no cargó, el de la cuenta de Google o el email. */
  readonly displayName = computed(() => {
    const fromDb = this.profile.hasValue() ? this.profile.value()?.name : undefined;
    if (fromDb) return fromDb;
    const user = this.auth.user();
    const fromGoogle = user?.user_metadata?.['full_name'] as string | undefined;
    return fromGoogle ?? user?.email?.split('@')[0] ?? '';
  });
}
