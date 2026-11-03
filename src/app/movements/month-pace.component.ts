import { Component, computed, inject, linkedSignal, output } from '@angular/core';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { formatMoney, formatMoneyCompact } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import { monthNameOf } from './summary.model';
import { InsightsStore } from './insights-store';
import { MovementsStore } from './movements-store';
import { MonthlyChartComponent } from './monthly-chart.component';
import { paceOf } from './pace.model';

const W = 600;
const H = 220;
const LEFT = 6;
const RIGHT = 6;
const TOP = 26;
const BOTTOM = 34;

/**
 * "Ritmo del mes" en Inicio: responde "¿voy bien?" en vez de mostrar barras vacías.
 * - Este mes: cuánto te queda por día, gasto acumulado hasta hoy, el mes anterior en gris para comparar a la
 *   misma altura y los ingresos como techo.
 * - 6 meses (solo con historial): barras por mes con la línea de promedio.
 */
@Component({
  selector: 'app-month-pace',
  imports: [MonthlyChartComponent, TranslatePipe],
  template: `
    <div class="head">
      <h2 id="pace-title">{{ 'paceTitle' | t }}</h2>
      @if (hasMonths()) {
        <div class="seg" role="tablist" [attr.aria-label]="'paceTitle' | t">
          <button type="button" role="tab" [class.on]="tab() === 'month'" [attr.aria-selected]="tab() === 'month'" (click)="tab.set('month')">
            {{ 'paceThisMonth' | t }}
          </button>
          <button type="button" role="tab" [class.on]="tab() === 'months'" [attr.aria-selected]="tab() === 'months'" (click)="tab.set('months')">
            {{ 'paceMonthsTab' | t: '' + monthsCount() }}
          </button>
        </div>
      }
    </div>

    @if (tab() === 'months' && hasMonths()) {
      <p class="headline">
        {{ 'paceAvgPrefix' | t }} <span class="acc">{{ compact(average() ?? 0) }}</span> {{ 'pacePerMonth' | t }}
      </p>
      <p class="sub">{{ monthsSub() }}</p>
      <app-monthly-chart [points]="insights.monthsTrend()" [average]="average()" />
    } @else {
      @let p = pace();
      @if (p.spent === 0 && p.today !== null) {
        <p class="headline">{{ 'paceNoExpenses' | t }}</p>
        <p class="sub">{{ 'paceNoExpensesHint' | t }}</p>
      } @else {
        <p class="headline">
          @if (p.today === null) {
            {{ 'paceSpentIn' | t: monthName() }} <span class="acc">{{ compact(p.spent) }}</span>
          } @else if (p.perDay !== null && remaining() >= 0) {
            {{ 'paceLeft' | t }} <span class="acc">{{ compact(remaining()) }}</span>
          } @else if (p.perDay !== null) {
            {{ 'paceOver' | t }} <span class="bad">{{ compact(-remaining()) }}</span>
          } @else {
            {{ 'paceSpent' | t }} <span class="acc">{{ compact(p.spent) }}</span> {{ 'paceInDays' | t: '' + p.today }}
          }
        </p>
        <p class="sub">
          @if (p.today === null) {
            {{ 'paceClosedMonth' | t }}
          } @else if (p.perDay !== null && remaining() >= 0) {
            ≈ <strong>{{ money(roundHundreds(p.perDay)) }} {{ 'pacePerDay' | t }}</strong> {{ 'paceDaysLeft' | t: '' + p.daysLeft }}
          } @else if (p.perDay !== null) {
            {{ 'paceOverHint' | t }}
          } @else if (p.today <= 7) {
            {{ 'paceEarlyHint' | t }}
          } @else {
            {{ 'paceDailyAvg' | t: money(p.spent / p.today) }}
          }
        </p>
        @if (p.vsPrevious !== null) {
          <span class="chip" [class.good]="p.vsPrevious <= 0" [class.bad]="p.vsPrevious > 0">
            {{ vsKey(p.vsPrevious, p.today === null) | t: compact(abs(p.vsPrevious)) : previousName() }}
          </span>
        } @else if (p.today !== null && p.perDay === null) {
          <button type="button" class="cta" (click)="addIncome.emit()">+ {{ 'paceAddIncome' | t }}</button>
        }

        <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="ariaLabel()">
          @for (y of grid; track y) {
            <line class="grid" [attr.x1]="left" [attr.x2]="w - right" [attr.y1]="y" [attr.y2]="y" />
          }
          <line class="axis" [attr.x1]="left" [attr.x2]="w - right" [attr.y1]="baseY" [attr.y2]="baseY" />
          @if (chart().futureX !== null) {
            <rect class="future" [attr.x]="chart().futureX" [attr.y]="top" [attr.width]="w - right - chart().futureX!" [attr.height]="baseY - top" />
          }
          @if (chart().incomeY; as y) {
            <line class="income" [attr.x1]="left" [attr.x2]="w - right" [attr.y1]="y" [attr.y2]="y" />
            <text class="income-label" [attr.x]="w - right" [attr.y]="y - 8" text-anchor="end">{{ 'paceIncomeLabel' | t: compact(ingresos()) }}</text>
          }
          @if (chart().previous; as prev) {
            <polyline class="prev" [attr.points]="prev.points" />
            <text class="prev-label" [attr.x]="prev.labelX" [attr.y]="prev.labelY" text-anchor="end">{{ previousName() }}</text>
          }
          <path class="area" [attr.d]="chart().area" />
          <polyline class="now" [attr.points]="chart().line" />
          @if (chart().end; as end) {
            @if (p.today !== null) {
              <line class="today" [attr.x1]="end.x" [attr.x2]="end.x" [attr.y1]="top" [attr.y2]="baseY" />
            }
            <circle class="dot" [attr.cx]="end.x" [attr.cy]="end.y" r="7" />
            <text class="end-label" [attr.x]="end.labelX" [attr.y]="end.y + 5" [attr.text-anchor]="end.anchor">{{ compact(p.spent) }}</text>
          }
          @for (tick of chart().ticks; track tick.label) {
            <text class="tick" [class.hoy]="tick.today" [attr.x]="tick.x" [attr.y]="h - 10" [attr.text-anchor]="tick.anchor">{{ tick.label }}</text>
          }
        </svg>

        <div class="legend">
          <span><i class="ln now"></i>{{ monthNameCap() }}</span>
          @if (chart().previous) {
            <span><i class="ln prev"></i>{{ previousNameCap() }}</span>
          }
          @if (chart().incomeY) {
            <span><i class="ln inc"></i>{{ 'income' | t }}</span>
          }
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .seg { display: flex; padding: 3px; border-radius: 10px; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border); }
    .seg button {
      padding: 5px 10px; border: 0; border-radius: 7px; font: inherit; font-size: 13px; font-weight: 600;
      color: var(--wl-muted); background: none; cursor: pointer;
    }
    .seg button.on { color: var(--ion-text-color); background: var(--wl-surface); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
    .headline { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
    .acc { color: var(--ion-color-primary); }
    .bad { color: var(--ion-color-danger); }
    .sub { margin: 4px 0 10px; font-size: 14px; line-height: 1.4; color: var(--wl-muted); }
    .sub strong { color: var(--ion-text-color); }
    .chip { display: inline-block; margin-bottom: 8px; padding: 6px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; }
    .chip.good { color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.12); }
    .chip.bad { color: var(--ion-color-danger); background: rgba(var(--ion-color-danger-rgb), 0.12); }
    .cta {
      display: block; margin-bottom: 8px; padding: 8px 10px; border: 0; border-radius: 10px; font: inherit; font-size: 14px;
      font-weight: 600; text-align: left; color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.1); cursor: pointer;
    }
    svg { display: block; width: 100%; height: auto; overflow: visible; margin-top: 4px; }
    .grid { stroke: var(--wl-field-bg); stroke-width: 1; }
    .axis { stroke: var(--wl-field-border); stroke-width: 1; }
    .future { fill: var(--wl-field-bg); opacity: 0.45; }
    .income { stroke: var(--wl-type-ahorro); stroke-width: 2; stroke-dasharray: 6 6; }
    .income-label { font-size: 15px; font-weight: 600; fill: var(--wl-type-ahorro); }
    .prev { fill: none; stroke: var(--wl-muted); stroke-opacity: 0.7; stroke-width: 2.5; stroke-linejoin: round; }
    .prev-label { font-size: 15px; font-weight: 600; fill: var(--wl-muted); text-transform: capitalize; }
    .area { fill: rgba(var(--ion-color-primary-rgb), 0.16); }
    .now { fill: none; stroke: var(--ion-color-primary); stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; }
    .today { stroke: var(--ion-color-primary); stroke-width: 1.5; stroke-dasharray: 3 4; opacity: 0.6; }
    .dot { fill: var(--ion-color-primary); stroke: var(--wl-surface); stroke-width: 4; }
    .end-label { font-size: 16px; font-weight: 700; fill: var(--ion-text-color); }
    .tick { font-size: 15px; fill: var(--wl-muted); }
    .tick.hoy { fill: var(--ion-color-primary); font-weight: 700; }
    @media (max-width: 991.98px) {
      .income-label, .prev-label, .end-label, .tick { font-size: 21px; }
    }
    .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; font-size: 13px; color: var(--wl-muted); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .ln { display: inline-block; width: 16px; height: 3px; border-radius: 2px; }
    .ln.now { background: var(--ion-color-primary); }
    .ln.prev { background: var(--wl-muted); }
    .ln.inc { background: repeating-linear-gradient(90deg, var(--wl-type-ahorro) 0 4px, transparent 4px 7px); }
  `,
})
export class MonthPaceComponent {
  readonly insights = inject(InsightsStore);
  private readonly movements = inject(MovementsStore);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);

  readonly addIncome = output<void>();

  readonly w = W;
  readonly h = H;
  readonly left = LEFT;
  readonly right = RIGHT;
  readonly top = TOP;
  readonly baseY = H - BOTTOM;
  readonly grid = [0.25, 0.5, 0.75].map((f) => TOP + f * (H - BOTTOM - TOP));

  readonly hasMonths = computed(() => this.insights.monthsTrend().length >= 2);
  readonly monthsCount = computed(() => this.insights.monthsTrend().length);
  readonly average = this.insights.monthsAverage;
  /** Siempre arranca en "Este mes"; si se cambia de mes o de espacio, vuelve ahí. */
  readonly tab = linkedSignal<string, 'month' | 'months'>({ source: () => this.month(), computation: () => 'month' });

  private readonly month = computed(() => this.movements.range().from.slice(0, 7));
  private readonly previousMonth = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  readonly ingresos = computed(() => this.movements.summary().ingresos);
  readonly remaining = computed(() => this.movements.summary().disponible);

  readonly pace = computed(() =>
    paceOf({
      month: this.month(),
      previousMonth: this.previousMonth(),
      current: this.movements.list(),
      previous: this.insights.previousMonthRows(),
      ingresos: this.ingresos(),
      disponible: this.remaining(),
    }),
  );

  readonly monthName = computed(() => monthNameOf(this.month(), this.preferences.locale()));
  readonly previousName = computed(() => monthNameOf(this.previousMonth(), this.preferences.locale()));
  readonly monthNameCap = computed(() => cap(this.monthName()));
  readonly previousNameCap = computed(() => cap(this.previousName()));

  readonly monthsSub = computed(() => {
    const average = this.average();
    const current = this.insights.monthsTrend().at(-1);
    if (!average || !current) return '';
    const pct = String(Math.round((current.gastos / average) * 100));
    const p = this.pace();
    return p.today !== null
      ? this.i18n.t('paceMonthsSubOpen', cap(current.label), pct, String(p.daysLeft ?? 0))
      : this.i18n.t('paceMonthsSub', cap(current.label), pct);
  });

  /** Coordenadas del gráfico de líneas. */
  readonly chart = computed(() => {
    const p = this.pace();
    const income = this.ingresos();
    const prevTotal = p.previous?.at(-1) ?? 0;
    const max = Math.max(p.spent, prevTotal, income, 1) * 1.08;
    const x = (day: number) => LEFT + ((day - 1) / Math.max(p.days - 1, 1)) * (W - LEFT - RIGHT);
    const y = (v: number) => TOP + (1 - v / max) * (this.baseY - TOP);

    const pts = p.cumulative.map((v, i) => [x(i + 1), y(v)] as const);
    const line = pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
    const area = pts.length
      ? `M${pts[0][0].toFixed(1)},${this.baseY} ` + pts.map(([a, b]) => `L${a.toFixed(1)},${b.toFixed(1)}`).join(' ') + ` L${pts.at(-1)![0].toFixed(1)},${this.baseY} Z`
      : '';
    const last = pts.at(-1);
    const nearRight = last ? last[0] > W * 0.7 : false;
    const end = last ? { x: last[0], y: last[1], labelX: nearRight ? last[0] - 14 : last[0] + 14, anchor: nearRight ? 'end' : 'start' } : null;

    let previous: { points: string; labelX: number; labelY: number } | null = null;
    if (p.previous) {
      // El mes anterior puede tener otra cantidad de días: se dibuja hasta donde entra en este.
      const prev = p.previous.slice(0, p.days);
      previous = {
        points: prev.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' '),
        labelX: x(prev.length),
        labelY: y(prev.at(-1) ?? 0) + 24,
      };
    }

    const ticks: { label: string; x: number; anchor: string; today: boolean }[] = [];
    for (const day of [1, 8, 15, 22, p.days]) {
      if (p.today !== null && Math.abs(day - p.today) < 4) continue;
      ticks.push({ label: String(day), x: x(day), anchor: day === 1 ? 'start' : day === p.days ? 'end' : 'middle', today: false });
    }
    if (p.today !== null) {
      ticks.push({ label: this.i18n.t('today'), x: x(p.today), anchor: p.today < 3 ? 'start' : 'middle', today: true });
    }

    return {
      line,
      area,
      end,
      previous,
      ticks,
      incomeY: income > 0 ? y(income) : null,
      futureX: p.today !== null && p.today < p.days ? x(p.today) : null,
    };
  });

  readonly ariaLabel = computed(() => {
    const p = this.pace();
    return `${this.i18n.t('paceTitle')}: ${this.money(p.spent)}`;
  });

  money(value: number): string {
    return formatMoney(Math.round(value), this.preferences.currency());
  }

  compact(value: number): string {
    return formatMoneyCompact(value, this.preferences.currency());
  }

  vsKey(diff: number, closed: boolean): 'paceBelow' | 'paceAbove' | 'paceBelowClosed' | 'paceAboveClosed' {
    if (closed) return diff <= 0 ? 'paceBelowClosed' : 'paceAboveClosed';
    return diff <= 0 ? 'paceBelow' : 'paceAbove';
  }

  /** "$ 129.916 por día" se lee peor que "$ 129.900": es una guía, no un monto exacto. */
  roundHundreds(value: number): number {
    return value >= 1000 ? Math.floor(value / 100) * 100 : Math.floor(value);
  }

  abs(value: number): number {
    return Math.abs(value);
  }
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
