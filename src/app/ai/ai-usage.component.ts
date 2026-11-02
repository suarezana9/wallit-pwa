import { Component, computed, inject, resource } from '@angular/core';
import { TranslatePipe } from '../core/i18n/i18n';
import { AiService } from './ai.service';

/** Cuenta: cuánto de la IA usaste hoy. No se muestra si el límite todavía no está instalado. */
@Component({
  selector: 'app-ai-usage',
  imports: [TranslatePipe],
  template: `
    @if (usage.hasValue() && usage.value(); as u) {
      <section class="wl-panel" aria-labelledby="ai-usage-title">
        <div class="head">
          <h2 id="ai-usage-title">✨ {{ 'aiUsageTitle' | t }}</h2>
          <span class="count" [class.full]="left() === 0">{{ 'aiUsageCount' | t: '' + u.used : '' + u.limit }}</span>
        </div>
        <div class="bar" role="progressbar" [attr.aria-valuenow]="u.used" aria-valuemin="0" [attr.aria-valuemax]="u.limit">
          <span [style.width.%]="percent()" [class.warn]="percent() >= 80"></span>
        </div>
        <p class="hint">
          @if (left() === 0) {
            {{ 'aiUsageFull' | t }}
          } @else {
            {{ 'aiUsageHint' | t: '' + u.costs.texto : '' + u.costs.audio : '' + u.costs.imagen }}
          }
        </p>
      </section>
    }
  `,
  styles: `
    .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    h2 { margin: 0; font-size: 16px; font-weight: 700; }
    .count { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--wl-muted); }
    .count.full { color: var(--ion-color-danger); }
    .bar { height: 8px; border-radius: 999px; background: var(--wl-field-bg); overflow: hidden; }
    .bar span {
      display: block; height: 100%; border-radius: inherit; transition: width 0.3s ease;
      background: linear-gradient(90deg, #8f6bff, #5a35f0);
    }
    .bar span.warn { background: linear-gradient(90deg, #f59e0b, #e5484d); }
    .hint { margin: 10px 0 0; font-size: 13px; line-height: 1.45; color: var(--wl-muted); }
  `,
})
export class AiUsageComponent {
  private readonly ai = inject(AiService);

  readonly usage = resource({ loader: () => this.ai.usage() });
  readonly percent = computed(() => {
    const u = this.usage.hasValue() ? this.usage.value() : null;
    return u ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
  });
  readonly left = computed(() => {
    const u = this.usage.hasValue() ? this.usage.value() : null;
    return u ? Math.max(0, u.limit - u.used) : 0;
  });
}
