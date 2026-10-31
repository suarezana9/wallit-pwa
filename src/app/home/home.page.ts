import { Component, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher,
  IonRefresherContent, IonSkeletonText, IonToolbar, RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, arrowDownOutline, arrowUpOutline } from 'ionicons/icons';
import { ProfileStore } from '../core/profile-store';
import { MoneyPipe } from '../core/money';
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
import { MonthlyChartComponent } from '../movements/monthly-chart.component';
import { AiQuickAddComponent } from '../ai/ai-quick-add.component';
import { BudgetCardComponent } from '../budgets/budget-card.component';
import { BudgetsStore } from '../budgets/budgets-store';
import { ShareInbox } from '../share/share-inbox';
import { GroupBalanceBannerComponent } from '../groups/group-balance-banner.component';
import { RecurringManagerComponent } from '../movements/recurring-manager.component';
import { RecurringPendingComponent } from '../movements/recurring-pending.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    AiQuickAddComponent, BudgetCardComponent, GroupBalanceBannerComponent, CategoryBreakdownComponent, ContextSwitcherComponent, IonButton, IonContent, IonFab, IonFabButton, IonHeader,
    IonIcon, IonRefresher, IonRefresherContent, IonSkeletonText, IonToolbar, MoneyPipe,
    MonthNavComponent, MonthlyChartComponent, MovementEditorComponent, MovementListComponent,
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
  private readonly i18n = inject(I18n);
  private readonly groups = inject(GroupsStore);
  private readonly preferences = inject(PreferencesStore);

  readonly summary = this.store.summary;
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
    addIcons({ add, arrowDownOutline, arrowUpOutline });
  }

  /** Hook de Ionic: corre cada vez que se entra a Inicio, también si la página ya estaba creada. */
  ionViewDidEnter(): void {
    const shared = this.shareInbox.claim();
    if (shared) this.editor().openNew(shared);
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
