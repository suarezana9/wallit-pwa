import { Service, signal } from '@angular/core';
import type { AiResult } from '../ai/ai.model';

/** Mismo nombre y claves que usa public/wallit-sw.js. */
const SHARE_CACHE = 'wallit-share';

export interface SharedPayload {
  file: File | null;
  text: string;
}

function shareKey(name: 'file' | 'text'): string {
  return new URL(`__wallit-share/${name}`, document.baseURI).href;
}

/**
 * Puente entre lo que otra app compartió con Wallit y la pantalla de carga.
 * El service worker deja la foto o el texto en Cache Storage; esta clase lo lee una sola vez
 * y, cuando la IA termina, guarda el resultado para que Inicio abra el formulario precargado.
 */
@Service()
export class ShareInbox {
  private readonly pending = signal<AiResult | null>(null);

  async take(): Promise<SharedPayload | null> {
    if (typeof caches === 'undefined') return null;
    const cache = await caches.open(SHARE_CACHE);
    const [fileRes, textRes] = await Promise.all([cache.match(shareKey('file')), cache.match(shareKey('text'))]);
    await Promise.all([cache.delete(shareKey('file')), cache.delete(shareKey('text'))]);
    const blob = fileRes ? await fileRes.blob() : null;
    const file = blob?.size ? new File([blob], 'compartido', { type: blob.type || 'image/jpeg' }) : null;
    const text = textRes ? (await textRes.text()).trim() : '';
    return file || text ? { file, text } : null;
  }

  hand(result: AiResult): void {
    this.pending.set(result);
  }

  /** Devuelve el resultado pendiente (si hay) y lo borra, para que no se abra dos veces. */
  claim(): AiResult | null {
    const result = this.pending();
    this.pending.set(null);
    return result;
  }
}
