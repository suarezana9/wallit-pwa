import { Service, inject } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { Supabase } from '../core/supabase';
import { AvatarStorage } from '../shared/avatar-storage';

const RECEIPTS_BUCKET = 'receipts';

/** Acciones sobre la cuenta: enviar comentarios y eliminarla (migración 023). */
@Service()
export class AccountService {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly avatars = inject(AvatarStorage);

  async sendFeedback(text: string, screen: string): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId || !text.trim()) return false;
    const { error } = await this.supabase.from('comentarios').insert({
      user_id: userId,
      texto: text.trim().slice(0, 2000),
      pantalla: screen.slice(0, 200),
      dispositivo: navigator.userAgent.slice(0, 300),
    });
    return !error;
  }

  /**
   * Borra las fotos (perfil y tickets que no quedan en grupos compartidos), después los datos con
   * eliminar_mi_cuenta() y por último cierra la sesión. Devuelve false si falló el paso de la base.
   */
  async deleteAccount(): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;

    await this.avatars.removeAll(`users/${userId}`).catch(() => undefined);
    // Tickets de lo que se va a borrar: lo personal y lo privado. Los de gastos compartidos quedan para el grupo.
    const { data: own } = await this.supabase
      .from('expenses')
      .select('receipt_url, group_id, is_private')
      .eq('user_id', userId)
      .not('receipt_url', 'is', null);
    const paths = (own ?? []).filter((e) => !e.group_id || e.is_private).map((e) => e.receipt_url as string);
    if (paths.length) await this.supabase.storage.from(RECEIPTS_BUCKET).remove(paths).then(() => undefined, () => undefined);

    const { error } = await this.supabase.rpc('eliminar_mi_cuenta');
    if (error) {
      console.warn('[cuenta] eliminar', error.message);
      return false;
    }
    await this.auth.signOut().catch(() => undefined);
    return true;
  }
}
