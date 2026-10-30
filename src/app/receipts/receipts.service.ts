import { Service, inject } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { Supabase } from '../core/supabase';
import { RECEIPTS_BUCKET, isExternalUrl, receiptPath } from './receipt.model';

const SIGNED_SECONDS = 60 * 60;

/** Fotos de comprobantes en Supabase Storage (bucket privado "receipts", una carpeta por usuario). */
@Service()
export class ReceiptsService {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly signed = new Map<string, { url: string; expires: number }>();

  /** Sube la foto y devuelve su ruta en el bucket, o null si falló. */
  async upload(dataUrl: string): Promise<string | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;
    const blob = await fetch(dataUrl).then((res) => res.blob());
    const path = receiptPath(userId, crypto.randomUUID(), blob.type);
    const { error } = await this.supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    return error ? null : path;
  }

  /** URL para mostrar la foto: firmada por una hora (y cacheada) porque el bucket es privado. */
  async url(ref: string): Promise<string | null> {
    if (isExternalUrl(ref)) return ref;
    const cached = this.signed.get(ref);
    if (cached && cached.expires > Date.now()) return cached.url;
    const { data, error } = await this.supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(ref, SIGNED_SECONDS);
    if (error || !data) return null;
    this.signed.set(ref, { url: data.signedUrl, expires: Date.now() + (SIGNED_SECONDS - 60) * 1000 });
    return data.signedUrl;
  }

  /** Borra el archivo. Si falla no es grave: queda huérfano en el bucket, no rompe nada. */
  async remove(ref: string | null): Promise<void> {
    if (!ref || isExternalUrl(ref)) return;
    this.signed.delete(ref);
    await this.supabase.storage.from(RECEIPTS_BUCKET).remove([ref]);
  }
}
