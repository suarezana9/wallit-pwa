import { Service, inject } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import type { Json, Movimiento } from '../core/database.types';
import { I18n } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import { Supabase } from '../core/supabase';
import { AiError, AiService } from '../ai/ai.service';
import { MonthReport, SummaryText, buildReport, monthBounds, previousMonthOf, reportForAi } from './summary.model';

/**
 * Arma el resumen de un mes: trae los movimientos del mes y del anterior y calcula la comparación (rápido),
 * y aparte le pide a la IA el texto, una sola vez por mes y espacio (queda guardado en resumenes_ia).
 */
@Service()
export class SummaryService {
  private readonly supabase = inject(Supabase).client;
  private readonly auth = inject(AuthStore);
  private readonly ai = inject(AiService);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);

  async report(month: string, groupId: string | null): Promise<MonthReport> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('NO_SESSION');
    const previous = previousMonthOf(month);
    const rows = await this.movements(userId, groupId, monthBounds(previous).from, monthBounds(month).to);
    return buildReport(
      month,
      previous,
      rows.filter((m) => m.date.startsWith(month)),
      rows.filter((m) => m.date.startsWith(previous)),
    );
  }

  /** El texto guardado o, si no hay, uno nuevo de la IA. Tira AiError si la IA no responde. */
  async text(groupId: string | null, report: MonthReport, fresh = false): Promise<SummaryText> {
    if (!fresh) {
      const cached = await this.cached(report.month, groupId);
      if (cached) return cached;
    }
    let ai: SummaryText;
    try {
      ai = await this.ai.summary(reportForAi(report, (n) => this.i18n.category(n)));
    } catch (error) {
      throw error instanceof AiError ? error : new AiError('errAi');
    }
    await this.save(report.month, groupId, ai);
    return ai;
  }

  private async movements(userId: string, groupId: string | null, from: string, to: string): Promise<Movimiento[]> {
    const base = this.supabase.from('expenses').select('*');
    const scoped = groupId ? base.eq('group_id', groupId) : base.eq('user_id', userId).is('group_id', null);
    const { data, error } = await scoped.gte('date', from).lte('date', to).limit(5000);
    if (error) throw error;
    return data;
  }

  private async cached(month: string, groupId: string | null): Promise<SummaryText | null> {
    const { data, error } = await this.supabase
      .from('resumenes_ia')
      .select('contenido')
      .eq('espacio', groupId ?? 'personal')
      .eq('mes', month)
      .eq('idioma', this.preferences.language())
      .maybeSingle();
    if (error || !data) return null;
    const c = data.contenido as { title?: string; points?: string[]; tip?: string | null };
    return c?.title && Array.isArray(c.points) ? { title: c.title, points: c.points, tip: c.tip ?? null } : null;
  }

  private async save(month: string, groupId: string | null, text: SummaryText): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    // Sin la migración 020 no hay dónde guardarlo: se muestra igual, solo que no queda guardado.
    await this.supabase.from('resumenes_ia').upsert({
      user_id: userId,
      espacio: groupId ?? 'personal',
      mes: month,
      idioma: this.preferences.language(),
      contenido: text as unknown as Json,
    });
  }
}
