import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher,
  IonRefresherContent, IonSkeletonText, IonToolbar, RefresherCustomEvent, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, arrowDownOutline, arrowUpOutline, checkmark, chevronForward, closeOutline, copyOutline, sparkles } from 'ionicons/icons';
import { ProfileStore } from '../core/profile-store';
import { MoneyPipe, formatMoney } from '../core/money';
import { amountForClipboard } from '../core/amount';
import type { TipoMovimiento } from '../core/database.types';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import { WallitLogoComponent } from '../shared/wallit-logo';
import { MonthNavComponent } from '../shared/month-nav.component';
import { ContextSwitcherComponent } from '../groups/context-switcher.component';
import { GroupsStore } from '../groups/groups-store';
import { MovementsStore } from '../movements/movements-store';
import { InsightsStore } from '../movements/insights-store';
import { CategoryBreakdownComponent } from '../movements/category-breakdown.component';
import { MovementEditorComponent } from '../movements/movement-editor.component';
import { MovementListComponent } from '../movements/movement-list.component';
import { MonthPaceComponent } from '../movements/month-pace.component';
import { AiQuickAddComponent } from '../ai/ai-quick-add.component';
import { BudgetCardComponent } from '../budgets/budget-card.component';
import { BudgetsStore } from '../budgets/budgets-store';
import { ShareInbox } from '../share/share-inbox';
import { GroupBalanceBannerComponent } from '../groups/group-balance-banner.component';
import { RecurringManagerComponent } from '../movements/recurring-manager.component';
import { RecurringPendingComponent } from '../movements/recurring-pending.component';

import { MonthlySummaryComponent } from '../movements/monthly-summary.component';
import { GettingStartedComponent, StepAction, injectGettingStarted } from './getting-started.component';
import { isMonthKey, monthNameOf } from '../movements/summary.model';
import { monthRange } from '../core/dates';

/** Hasta qué día del mes se muestra la tarjeta con el resumen del mes anterior. */
const SUMMARY_CARD_UNTIL_DAY = 10;
const SUMMARY_CLOSED_KEY = 'wallit_resumen_cerrado';

function readClosed(): string | null {
  try {
    return localStorage.getItem(SUMMARY_CLOSED_KEY);
  } catch {
    return null;
  }
}
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    AiQuickAddComponent, BudgetCardComponent, GroupBalanceBannerComponent, CategoryBreakdownComponent, ContextSwitcherComponent, IonButton, IonContent, IonFab, IonFabButton, IonHeader,
    IonIcon, IonRefresher, IonRefresherContent, IonSkeletonText, IonToolbar, MoneyPipe,
    GettingStartedComponent, MonthNavComponent, MonthPaceComponent, MonthlySummaryComponent, MovementEditorComponent, MovementListComponent,
    RecurringManagerComponent, RecurringPendingComponent, RouterLink, TranslatePipe, WallitLogoComponent,
  ],
})
export class HomePage {
  readonly store = inject(MovementsStore);
  readonly insights = inject(InsightsStore);
  readonly displayName = inject(ProfileStore).displayName;
  readonly activeGroup = computed(() => this.groups.active()?.group ?? null);
  // En celular el selector de espacio ya dice dónde estás; el título queda como saludo.
  readonly mobileTitle = computed(() => this.i18n.t('hello', this.displayName()));
  readonly editor = viewChild.required(MovementEditorComponent);
  readonly fixedManager = viewChild.required(RecurringManagerComponent);
  readonly monthlySummary = viewChild.required(MonthlySummaryComponent);
  private readonly i18n = inject(I18n);
  private readonly groups = inject(GroupsStore);
  private readonly preferences = inject(PreferencesStore);

  readonly summary = this.store.summary;
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastController);
  readonly copied = signal(false);
  private readonly route = inject(ActivatedRoute);

  /** Mes del que se ofrece el resumen: el que estás mirando si es pasado, o el anterior en los primeros días del mes. */
  private readonly closedSummary = signal(readClosed());
  private readonly summaryScope = computed(() => this.groups.activeGroupId() ?? 'personal');
  readonly summaryCardMonth = computed(() => {
    if (this.store.monthOffset() !== 0 || new Date().getDate() > SUMMARY_CARD_UNTIL_DAY) return null;
    const points = this.insights.months();
    const previous = points[points.length - 2];
    if (!previous?.gastos) return null;
    return this.closedSummary() === `${previous.key}|${this.summaryScope()}` ? null : previous.key;
  });
  readonly pastMonth = computed(() => (this.store.monthOffset() < 0 ? monthRange(this.store.monthOffset()).from.slice(0, 7) : null));
  readonly monthNameOf = (month: string) => monthNameOf(month, this.preferences.locale());

  /**
   * Sin meses anteriores con gastos el gráfico de evolución queda vacío: en su lugar, los primeros pasos,
   * hasta que estén todos hechos o haya historial.
   */
  private readonly steps = injectGettingStarted();
  readonly showGettingStarted = computed(
    () => this.store.monthOffset() === 0 && this.insights.hasHistory() === false && this.steps().some((s) => !s.done),
  );

  onStep(action: StepAction): void {
    if (action === 'fixed') this.fixedManager().open();
    else this.editor().openNewOfType(action === 'expense' ? 'gasto' : 'ingreso');
  }

  openSummary(month: string): void {
    this.monthlySummary().open(month, this.groups.activeGroupId());
  }

  closeSummaryCard(month: string): void {
    const value = `${month}|${this.summaryScope()}`;
    this.closedSummary.set(value);
    try {
      localStorage.setItem(SUMMARY_CLOSED_KEY, value);
    } catch {
      // Sin almacenamiento: se oculta hasta que recargues.
    }
  }

  readonly kpis = computed(() => {
    const s = this.summary();
    return [
      { tipo: 'ingreso' as const, label: 'income' as const, total: s.ingresos, color: 'var(--wl-type-ingreso)' },
      { tipo: 'gasto' as const, label: 'expenses' as const, total: s.gastos, color: 'var(--wl-type-gasto)' },
      { tipo: 'ahorro' as const, label: 'savings' as const, total: s.ahorros, color: 'var(--wl-type-ahorro)' },
      { tipo: 'inversion' as const, label: 'investments' as const, total: s.inversiones, color: 'var(--wl-type-inversion)' },
    ];
  });

  /** Lo que muestra la tarjeta grande: el disponible si hay ingresos, si no lo gastado. */
  readonly mainAmount = computed(() => (this.hasIncome() ? this.summary().disponible : this.summary().gastos));

  /** Con movimientos, lleva a la lista filtrada; si todavía no hay, abre la carga de ese tipo. */
  openKpi(tipo: TipoMovimiento, total: number): void {
    if (total) void this.router.navigate(['/movimientos'], { queryParams: { tipo } });
    else this.editor().openNewOfType(tipo);
  }

  openCategory(categoria: string): void {
    void this.router.navigate(['/movimientos'], { queryParams: { categoria } });
  }

  /** Copia el monto listo para pegar en una transferencia (sin $ ni separador de miles). */
  async copyMain(): Promise<void> {
    const amount = Math.round(this.mainAmount() * 100) / 100;
    try {
      await navigator.clipboard.writeText(amountForClipboard(amount, this.preferences.language()));
    } catch {
      return;
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
    const toast = await this.toasts.create({
      message: this.i18n.t('amountCopied', formatMoney(amount, this.preferences.currency())),
      duration: 1600,
      position: 'top',
      color: 'dark',
    });
    await toast.present();
  }
  readonly hasIncome = computed(() => this.summary().ingresos > 0);
  readonly recent = computed(() => this.store.list().slice(0, 5));
  readonly change = this.insights.expenseChange;
  private readonly budgets = inject(BudgetsStore);
  private readonly shareInbox = inject(ShareInbox);
  readonly topBudgets = computed(() => this.budgets.progress().slice(0, 3));

  readonly savingRateNote = computed(() => {
    const rate = this.summary().tasaAhorro;
    return rate === null ? '' : this.i18n.t('savingRate', this.percent(rate));
  });

  readonly changeNote = computed(() => {
    const change = this.change();
    return change ? this.i18n.t('vsMonth', this.percent(Math.abs(change.percent)), change.previousMonth) : '';
  });

  constructor() {
    addIcons({ add, arrowDownOutline, arrowUpOutline, checkmark, chevronForward, closeOutline, copyOutline, sparkles });
  }

  /** Hook de Ionic: corre cada vez que se entra a Inicio, también si la página ya estaba creada. */
  ionViewDidEnter(): void {
    const shared = this.shareInbox.claim();
    if (shared) this.editor().openNew(shared);
    // Desde el aviso del día 1: /inicio?resumen=YYYY-MM (es siempre del espacio personal).
    const month = this.route.snapshot.queryParamMap.get('resumen');
    if (isMonthKey(month)) {
      this.monthlySummary().open(month, null);
      void this.router.navigate([], { relativeTo: this.route, queryParams: { resumen: null }, replaceUrl: true });
    }
  }

  private percent(value: number): string {
    return Math.round(value).toLocaleString(this.preferences.locale());
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    this.store.movements.reload();
    this.insights.reload();
    await event.target.complete();
  }
}
