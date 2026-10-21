import { Component, computed, inject, input } from '@angular/core';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe, formatMoney, formatMoneyCompact } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import type { MonthPoint } from './insights-store';

const WIDTH = 600;
const HEIGHT = 200;
const TOP = 26;
const BOTTOM = 28;
const SLOT = WIDTH / 6;
const BAR = 44;
const RADIUS = 4;

function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(RADIUS, h);
  const base = y + h;
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`;
}

@Component({
  selector: 'app-monthly-chart',
  imports: [MoneyPipe, TranslatePipe],
  template: `
    @if (hasData()) {
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="summary()">
        <line class="baseline" x1="0" [attr.y1]="baseY" [attr.x2]="width" [attr.y2]="baseY" />
        @for (bar of bars(); track bar.key) {
          <g class="bar" [class.current]="bar.isCurrent">
            <rect class="hit" [attr.x]="bar.slotX" y="0" [attr.width]="slot" [attr.height]="height" />
            <path [attr.d]="bar.path" />
            <title>{{ bar.title }}</title>
            @if (bar.isCurrent) {
              <text class="value" [attr.x]="bar.cx" [attr.y]="bar.y - 8" text-anchor="middle">{{ bar.short }}</text>
            }
            <text class="month" [attr.x]="bar.cx" [attr.y]="height - 8" text-anchor="middle">{{ bar.label }}</text>
          </g>
        }
      </svg>
      <table class="sr-only">
        <caption>{{ 'chartCaption' | t }}</caption>
        <tr><th>{{ 'month' | t }}</th><th>{{ 'expenses' | t }}</th></tr>
        @for (point of points(); track point.key) {
          <tr><td>{{ point.label }}</td><td>{{ point.gastos | money }}</td></tr>
        }
      </table>
    } @else {
      <p class="empty">{{ 'chartEmpty' | t }}</p>
    }
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .baseline { stroke: var(--wl-field-border); stroke-width: 1; }
    .bar path { fill: rgba(var(--ion-color-primary-rgb), 0.28); transition: fill 0.15s ease; }
    .bar.current path { fill: var(--ion-color-primary); }
    .bar:hover path { fill: rgba(var(--ion-color-primary-rgb), 0.55); }
    .bar.current:hover path { fill: var(--ion-color-primary-shade); }
    .hit { fill: transparent; }
    .month { font-size: 13px; fill: var(--wl-muted); text-transform: capitalize; }
    .bar.current .month { fill: var(--ion-text-color); font-weight: 600; }
    .value { font-size: 13px; font-weight: 600; fill: var(--ion-text-color); }
    .empty { margin: 0; padding: 24px 0; text-align: center; color: var(--wl-muted); font-size: 14px; }
    @media (max-width: 991.98px) {
      .month, .value { font-size: 21px; }
    }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
})
export class MonthlyChartComponent {
  readonly points = input.required<readonly MonthPoint[]>();
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);

  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly slot = SLOT;
  readonly baseY = HEIGHT - BOTTOM;

  readonly hasData = computed(() => this.points().some((p) => p.gastos > 0));

  readonly bars = computed(() => {
    const currency = this.preferences.currency();
    const max = Math.max(...this.points().map((p) => p.gastos), 1);
    const usable = this.baseY - TOP;
    return this.points().map((p, i) => {
      const h = (p.gastos / max) * usable;
      const x = i * SLOT + (SLOT - BAR) / 2;
      const y = this.baseY - h;
      return {
        key: p.key,
        label: p.label,
        isCurrent: p.isCurrent,
        slotX: i * SLOT,
        cx: x + BAR / 2,
        y,
        path: barPath(x, y, BAR, h),
        title: `${p.label}: ${formatMoney(p.gastos, currency)}`,
        short: formatMoneyCompact(p.gastos, currency),
      };
    });
  });

  readonly summary = computed(() => {
    const currency = this.preferences.currency();
    const values = this.points().map((p) => `${p.label} ${formatMoney(p.gastos, currency)}`).join(', ');
    return `${this.i18n.t('chartSummary')}: ${values}`;
  });
}
