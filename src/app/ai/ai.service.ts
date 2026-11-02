import { Service, inject } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toIsoDate } from '../core/dates';
import { PreferencesStore } from '../core/preferences-store';
import { Supabase } from '../core/supabase';
import { CategoriesStore } from '../categories/categories-store';
import { AiErrorKey, AiResult, errorKeyFor, normalizeAiResponse } from './ai.model';
import { audioExtension } from './media';

const FUNCTION_NAME = 'wallit-ia';

export interface AiUsage {
  used: number;
  limit: number;
  costs: { texto: number; audio: number; imagen: number };
}

export class AiError extends Error {
  constructor(public readonly key: AiErrorKey) {
    super(key);
  }
}

@Service()
export class AiService {
  private readonly supabase = inject(Supabase).client;
  private readonly preferences = inject(PreferencesStore);
  private readonly categories = inject(CategoriesStore);

  fromText(text: string): Promise<AiResult> {
    return this.call({ mode: 'text', text, ...this.context() });
  }

  fromImage(dataUrl: string): Promise<AiResult> {
    return this.call({ mode: 'image', image: dataUrl, ...this.context() });
  }

  fromAudio(audio: Blob): Promise<AiResult> {
    const form = new FormData();
    form.append('audio', audio, `voz.${audioExtension(audio.type)}`);
    form.append('context', JSON.stringify(this.context()));
    return this.call(form);
  }

  /** Cuánto de la IA usaste hoy (migración 018). null si el límite no está instalado. */
  async usage(): Promise<AiUsage | null> {
    const { data, error } = await this.supabase.rpc('uso_ia_hoy');
    if (error || !data) return null;
    const value = data as { usados?: number; limite?: number; costos?: AiUsage['costs'] };
    if (typeof value.usados !== 'number' || typeof value.limite !== 'number') return null;
    return { used: value.usados, limit: value.limite, costs: value.costos ?? { texto: 1, audio: 2, imagen: 3 } };
  }

  private context() {
    return {
      lang: this.preferences.language(),
      currency: this.preferences.currency(),
      today: toIsoDate(new Date()),
      categories: this.categories.visible().map((c) => c.name),
    };
  }

  private async call(body: Record<string, unknown> | FormData): Promise<AiResult> {
    const { data, error } = await this.supabase.functions.invoke<unknown>(FUNCTION_NAME, { body });
    if (error) {
      let code: string | undefined;
      if (error instanceof FunctionsHttpError) {
        code = await (error.context as Response)
          .json()
          .then((payload: { error?: string }) => payload.error)
          .catch(() => undefined);
      }
      // Visible en DevTools > Console: el código real ayuda a diagnosticar (el mensaje al usuario es genérico).
      console.warn('[wallit-ia]', code ?? error.name, error.message);
      throw new AiError(errorKeyFor(code));
    }
    const result = normalizeAiResponse(data);
    if (!result) throw new AiError('errAi');
    return result;
  }
}
