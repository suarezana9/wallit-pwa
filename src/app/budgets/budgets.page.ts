import { Component, computed, inject, signal, viewChild } from '@angular/core';
import {
  IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher, IonRefresherContent,
  IonSkeletonText, IonTitle, IonToolbar, RefresherCustomEvent, ToastController, ViewWillEnter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, copyOutline, pieChartOutline } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { ContextSwitcherComponent } from '../groups/context-switcher.component';
import { GroupsStore } from '../groups/groups-store';
import { MonthNavComponent } from '../shared/month-nav.component';
import { BudgetCardComponent } from './budget-card.component';
import { BudgetDetailComponent } from './budget-detail.component';
import { BudgetEditorComponent } from './budget-editor.component';
import type { Budget } from './budget.model';
import { BudgetsStore } from './budgets-store';

@Component({
  selector: 'app-budgets',
  templateUrl: 'budgets.page.html',
  styleUrls: ['budgets.page.scss'],
  imports: [
    BudgetCardComponent, BudgetDetailComponent, BudgetEditorComponent, ContextSwitcherComponent, IonButton, IonContent,
    IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonSkeletonText, IonTitle,
    IonToolbar, MoneyPipe, MonthNavComponent, TranslatePipe,
  ],
})
export class BudgetsPage implements ViewWillEnter {
  readonly store = inject(BudgetsStore);
  private readonly groups = inject(GroupsStore);
  private readonly i18n = inject(I18n);
  private readonly toasts = inject(ToastController);

  readonly editor = viewChild.required(BudgetEditorComponent);
  readonly detail = viewChild.required(BudgetDetailComponent);

  readonly activeGroup = computed(() => this.groups.active()?.group ?? null);
  readonly remaining = computed(() => this.store.totals().limit - this.store.totals().spent);
  readonly usedPercent = computed(() => {
    const { limit, spent } = this.store.totals();
    return limit ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  });
  readonly canCopy = signal(false);
  readonly copying = signal(false);

  constructor() {
    addIcons({ add, copyOutline, pieChartOutline });
  }

  ionViewWillEnter(): void {
    this.store.reload();
    void this.checkPrevious();
  }

  openDetail(budget: Budget): void {
    this.detail().open(budget);
  }

  editFromDetail(budget: Budget): void {
    this.detail().close();
    this.editor().openEdit(budget);
  }

  async copyPrevious(): Promise<void> {
    this.copying.set(true);
    const { count, error } = await this.store.copyFromPreviousMonth();
    this.copying.set(false);
    const message = error ?? this.i18n.t('copiedBudgets', String(count));
    const toast = await this.toasts.create({ message, duration: 2200, position: 'top', color: error ? 'danger' : 'dark' });
    await toast.present();
    this.canCopy.set(false);
  }

  async checkPrevious(): Promise<void> {
    this.canCopy.set(this.store.canEdit() && (await this.store.hasPreviousMonthBudgets()));
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    this.store.reload();
    await event.target.complete();
  }
}
