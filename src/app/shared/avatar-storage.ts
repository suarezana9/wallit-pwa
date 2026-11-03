import { Service, inject } from '@angular/core';
import { Supabase } from '../core/supabase';

const BUCKET = 'avatars';
const SIZE = 256;

/** Recorta al centro en un cuadrado y lo achica a 256×256 JPEG: una foto de 4 MB queda en ~20 KB. */
export async function squareJpeg(file: Blob, size = SIZE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('NO_CANVAS');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('NO_BLOB');
  return blob;
}

/**
 * Fotos de perfil y de grupo en el bucket público "avatars" (migración 022).
 * Cada foto nueva va con otro nombre (así el navegador no muestra la vieja de caché) y se borran las anteriores.
 */
@Service()
export class AvatarStorage {
  private readonly supabase = inject(Supabase).client;

  /** folder: 'users/<id>' o 'groups/<id>'. Devuelve la URL pública. */
  async upload(folder: string, file: Blob): Promise<string> {
    const image = await squareJpeg(file);
    const path = `${folder}/${Date.now()}.jpg`;
    const { error } = await this.supabase.storage.from(BUCKET).upload(path, image, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    await this.removeAll(folder, path);
    return this.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /** Borra las fotos de la carpeta (menos keep). Si falla no importa: solo quedan archivos de más. */
  async removeAll(folder: string, keep?: string): Promise<void> {
    const { data } = await this.supabase.storage.from(BUCKET).list(folder);
    const old = (data ?? []).map((f) => `${folder}/${f.name}`).filter((p) => p !== keep);
    if (old.length) await this.supabase.storage.from(BUCKET).remove(old);
  }
}
