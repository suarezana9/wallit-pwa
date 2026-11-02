import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonSkeletonText, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowDownOutline, arrowUpOutline, closeOutline, refreshOutline, sparkles } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe, formatMoney } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import { CategoriesStore } from '../categories/categories-store';
import { AiError } from '../ai/ai.service';
import { MovementsStore } from './movements-store';
import { SummaryService } from './summary.service';
import { CategoryChange, MonthReport, SummaryText, fallbackSummary, monthNameOf, monthOffsetOf } from './summary.model';

type Status = 'loading' | 'ready' | 'error';

/**
 * Resumen de un mes: cuánto gastaste vs el anterior, qué categorías cambiaron y lo que encontró la IA.
 * Se abre desde la tarjeta de Inicio (días 1 a 10), desde un mes pasado o desde el aviso del día 1.
 */
@Component({
  selector: 'app-monthly-summary',
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonSkeletonText, IonTitle, IonToolbar, MoneyPipe, TranslatePipe],
  template: `
    <ion-modal class="wl-dialog wl-dialog-form" [isOpen]="isOpen()" (didDismiss)="isOpen.set(false)">
      <ng-template>
        <div class="ion-page">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ 'summaryTitle' | t: monthName() }}</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="isOpen.set(false)" [attr.aria-label]="'close' | t">
                  <ion-icon slot="icon-only" name="close-outline" />
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            @switch (status()) {
              @case ('loading') {
                <ion-skeleton-text [animated]="true" class="sk-hero" />
                <ion-skeleton-text [animated]="true" class="sk-card" />
                <ion-skeleton-text [animated]="true" class="sk-row" />
                <ion-skeleton-text [animated]="true" class="sk-row" />
              }
              @case ('error') {
                <div class="empty">
                  <span aria-hidden="true">📡</span>
                  <p>{{ 'summaryError' | t }}</p>
                  <ion-button class="wl-btn wl-btn-secondary" (click)="reload()">{{ 'retry' | t }}</ion-button>
                </div>
              }
              @default {
                @if (report(); as r) {
                  @if (!r.gastos && !r.ingresos) {
                    <div class="empty">
                      <span aria-hidden="true">🗓️</span>
                      <strong>{{ 'summaryEmpty' | t }}</strong>
                      <p>{{ 'summaryEmptyHint' | t }}</p>
                    </div>
                  } @else {
                    <section class="hero">
                      <span class="label">{{ 'summarySpent' | t }}</span>
                      <strong class="total">{{ r.gastos | money }}</strong>
                      @if (r.gastosPct !== null) {
                        <span class="badge" [class.up]="r.gastosPct > 0" [class.down]="r.gastosPct <= 0">
                          <ion-icon [name]="r.gastosPct > 0 ? 'arrow-up-outline' : 'arrow-down-outline'" aria-hidden="true" />
                          {{ 'vsMonth' | t: abs(r.gastosPct) : previousName() }}
                        </span>
                      } @else {
                        <span class="badge flat">{{ 'summaryFirstMonth' | t }}</span>
                      }
                      <div class="minis">
                        <span><small>{{ 'income' | t }}</small>{{ r.ingresos | money }}</span>
                        <span><small>{{ 'summarySaved' | t }}</small>{{ r.ahorro | money }}</span>
                        @if (r.tasaAhorro !== null) {
                          <span><small>{{ 'summarySavingRate' | t }}</small>{{ r.tasaAhorro }}%</span>
                        }
                      </div>
                    </section>

                    <section class="ai wl-summary-ai" [class.fallback]="!ai()" aria-live="polite">
                      <span class="eyebrow"><ion-icon name="sparkles" aria-hidden="true" /> {{ (ai() ? 'summaryAiEyebrow' : 'summaryNoAi') | t }}</span>
                      @if (aiLoading()) {
                        <p class="muted">{{ 'summaryAiLoading' | t }}</p>
                        <ion-skeleton-text [animated]="true" class="sk-line" />
                        <ion-skeleton-text [animated]="true" class="sk-line short" />
                      } @else {
                        @let text = shown();
                        <h3>{{ text.title }}</h3>
                        <ul>
                          @for (p of text.points; track $index) {
                            <li>{{ p }}</li>
                          }
                        </ul>
                        @if (text.tip) {
                          <p class="tip"><span aria-hidden="true">💡</span> {{ text.tip }}</p>
                        }
                        @if (aiError(); as err) {
                          <p class="why">{{ err | t }}</p>
                        }
                        <button type="button" class="link" (click)="regenerate()">
                          <ion-icon name="refresh-outline" aria-hidden="true" />
                          {{ (ai() ? 'summaryRegenerate' : 'summaryRetry') | t }}
                        </button>
                      }
                    </section>

                    <section>
                      <h4>{{ 'summaryChanges' | t }}</h4>
                      @for (c of changes(); track c.category) {
                        <div class="row">
                          <span class="avatar" [style.--c]="info(c.category).color" aria-hidden="true">{{ info(c.category).emoji }}</span>
                          <span class="text">
                            <strong>{{ categoryName(c.category) }}</strong>
                            <span>{{ c.previous | money }} → {{ c.current | money }}</span>
                          </span>
                          <span class="delta" [class.up]="c.delta > 0" [class.down]="c.delta < 0">
                            {{ c.delta > 0 ? '+' : '−' }}{{ absValue(c.delta) | money }}
                          </span>
                        </div>
                      } @empty {
                        <p class="muted">{{ 'summaryNoChanges' | t }}</p>
                      }
                    </section>

                    @if (r.biggest; as b) {
                      <section>
                        <h4>{{ 'summaryBiggest' | t }}</h4>
                        <div class="row">
                          <span class="avatar" [style.--c]="info(b.category).color" aria-hidden="true">{{ info(b.category).emoji }}</span>
                          <span class="text">
                            <strong>{{ b.description || categoryName(b.category) }}</strong>
                            <span>{{ categoryName(b.category) }}</span>
                          </span>
                          <span class="delta">{{ b.amount | money }}</span>
                        </div>
                      </section>
                    }

                    <ion-button expand="block" class="wl-btn wl-btn-secondary see" (click)="seeMovements()">
                      {{ 'summarySeeMovements' | t: monthName() }}
                    </ion-button>
                  }
                }
              }
            }
          </ion-content>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    ion-skeleton-text { border-radius: 14px; margin: 0 0 12px; }
    .sk-hero { height: 120px; }
    .sk-card { height: 150px; }
    .sk-row { height: 48px; }
    .sk-line { height: 14px; margin-bottom: 8px; }
    .sk-line.short { width: 60%; }
    .hero {
      padding: 18px; border-radius: 18px; margin-bottom: 14px;
      background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
      display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
    }
    .label { font-size: 14px; color: var(--wl-muted); }
    .total { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .badge {
      display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600;
      padding: 3px 9px; border-radius: 999px; background: var(--wl-surface); color: var(--wl-muted);
    }
    .badge.up { color: var(--ion-color-danger); background: color-mix(in srgb, var(--ion-color-danger) 12%, transparent); }
    .badge.down { color: var(--ion-color-success); background: color-mix(in srgb, var(--ion-color-success) 12%, transparent); }
    .minis { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 8px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .minis span { display: flex; flex-direction: column; font-size: 15px; }
    .minis small { font-size: 12px; font-weight: 500; color: var(--wl-muted); }
    .ai {
      position: relative; padding: 16px 18px; border-radius: 18px; margin-bottom: 18px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--ion-color-primary) 14%, var(--wl-field-bg)), var(--wl-field-bg));
      border: 1px solid color-mix(in srgb, var(--ion-color-primary) 30%, var(--wl-field-border));
    }
    .ai.fallback { background: var(--wl-field-bg); border-color: var(--wl-field-border); }
    .eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--ion-color-primary); text-transform: uppercase; letter-spacing: 0.04em; }
    .ai.fallback .eyebrow { color: var(--wl-muted); }
    .ai h3 { margin: 8px 0 6px; font-size: 17px; line-height: 1.3; }
    .ai ul { margin: 0; padding-inline-start: 18px; display: grid; gap: 6px; font-size: 15px; line-height: 1.45; }
    .tip { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: var(--wl-surface); font-size: 15px; line-height: 1.45; }
    .why { margin: 10px 0 0; font-size: 13px; color: var(--wl-muted); }
    .link {
      display: inline-flex; align-items: center; gap: 4px; margin-top: 10px; padding: 0;
      background: none; border: 0; font: inherit; font-size: 14px; font-weight: 600; color: var(--ion-color-primary); cursor: pointer;
    }
    h4 { margin: 0 0 6px; font-size: 14px; font-weight: 700; color: var(--wl-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    section + section { margin-top: 4px; }
    .row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--wl-field-border); }
    .row:last-child { margin-bottom: 14px; }
    .avatar {
      flex: none; width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; font-size: 17px;
      background: color-mix(in srgb, var(--c) 18%, transparent);
    }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .text strong { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .text span { font-size: 13px; color: var(--wl-muted); font-variant-numeric: tabular-nums; }
    .delta { font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }
    .delta.up { color: var(--ion-color-danger); }
    .delta.down { color: var(--ion-color-success); }
    .muted { color: var(--wl-muted); font-size: 15px; margin: 4px 0 14px; }
    .see { margin-top: 8px; }
    .empty { text-align: center; padding: 40px 12px; display: grid; justify-items: center; gap: 6px; }
    .empty span { font-size: 36px; }
    .empty p { margin: 0 0 8px; color: var(--wl-muted); }
  `,
})
export class MonthlySummaryComponent {
  private readonly summaries = inject(SummaryService);
  private readonly categories = inject(CategoriesStore);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);
  private readonly movements = inject(MovementsStore);
  private readonly router = inject(Router);

  readonly isOpen = signal(false);
  readonly month = signal('');
  private groupId: string | null = null;
  readonly status = signal<Status>('loading');
  readonly report = signal<MonthReport | null>(null);
  readonly ai = signal<SummaryText | null>(null);
  readonly aiError = signal<AiError['key'] | null>(null);
  readonly aiLoading = signal(false);
  /** Para descartar respuestas viejas si se abre otro mes antes de que termine. */
  private request = 0;

  readonly monthName = computed(() => (this.month() ? monthNameOf(this.month(), this.preferences.locale()) : ''));
  readonly previousName = computed(() => {
    const r = this.report();
    return r ? monthNameOf(r.previousMonth, this.preferences.locale()) : '';
  });

  readonly changes = computed<CategoryChange[]>(() => {
    const r = this.report();
    return r ? [...r.topUp, ...r.topDown] : [];
  });

  /** Lo de la IA o, si no está, el texto armado con reglas. */
  readonly shown = computed<SummaryText>(() => {
    const ai = this.ai();
    if (ai) return ai;
    const r = this.report();
    if (!r) return { title: '', points: [], tip: null };
    const currency = this.preferences.currency();
    return fallbackSummary(r, {
      money: (n) => formatMoney(n, currency),
      category: (n) => this.i18n.category(n),
      titleUp: (p) => this.i18n.t('sumTitleUp', p),
      titleDown: (p) => this.i18n.t('sumTitleDown', p),
      titleFlat: this.i18n.t('sumTitleFlat'),
      titleFirst: this.i18n.t('sumTitleFirst'),
      up: (c, a, p) => this.i18n.t('sumUp', c, a, p),
      down: (c, a) => this.i18n.t('sumDown', c, a),
      top: (c, a) => this.i18n.t('sumTop', c, a),
      saving: (p) => this.i18n.t('sumSaving', p),
    });
  });

  constructor() {
    addIcons({ arrowDownOutline, arrowUpOutline, closeOutline, refreshOutline, sparkles });
  }

  open(month: string, groupId: string | null): void {
    this.month.set(month);
    this.groupId = groupId;
    this.isOpen.set(true);
    void this.reload();
  }

  async reload(): Promise<void> {
    const id = ++this.request;
    this.status.set('loading');
    this.report.set(null);
    this.ai.set(null);
    this.aiError.set(null);
    let report: MonthReport;
    try {
      report = await this.summaries.report(this.month(), this.groupId);
    } catch {
      if (id === this.request) this.status.set('error');
      return;
    }
    if (id !== this.request) return;
    this.report.set(report);
    this.status.set('ready');
    if (report.gastos || report.ingresos) await this.loadText(id, false);
  }

  regenerate(): Promise<void> {
    return this.loadText(this.request, true);
  }

  private async loadText(id: number, fresh: boolean): Promise<void> {
    const report = this.report();
    if (!report) return;
    this.aiLoading.set(true);
    this.aiError.set(null);
    try {
      const text = await this.summaries.text(this.groupId, report, fresh);
      if (id === this.request) this.ai.set(text);
    } catch (error) {
      if (id === this.request) this.aiError.set(error instanceof AiError ? error.key : 'errAi');
    } finally {
      if (id === this.request) this.aiLoading.set(false);
    }
  }

  info(name: string) {
    return this.categories.info(name);
  }

  categoryName(name: string): string {
    return this.i18n.category(name);
  }

  absValue(n: number): number {
    return Math.abs(n);
  }

  abs(n: number): string {
    return Math.abs(n).toLocaleString(this.preferences.locale());
  }

  seeMovements(): void {
    this.movements.monthOffset.set(monthOffsetOf(this.month()));
    this.isOpen.set(false);
    void this.router.navigate(['/movimientos']);
  }
}
