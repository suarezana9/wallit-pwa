import { Component, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonRefresher,
  IonRefresherContent, IonSkeletonText, IonToolbar, RefresherCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, arrowDownOutline, arrowUpOutline } from 'ionicons/icons';
import { ProfileStore } from '../core/profile-store';
import { MoneyPipe } from '../core/money';
import { WallitLogoComponent } from '../shared/wallit-logo';
import { MonthNavComponent } from '../shared/month-nav.component';
import { MovementsStore } from '../movements/movements-store';
import { InsightsStore } from '../movements/insights-store';
import { CategoryBreakdownComponent } from '../movements/category-breakdown.component';
import { MovementEditorComponent } from '../movements/movement-editor.component';
import { MovementListComponent } from '../movements/movement-list.component';
import { MonthlyChartComponent } from '../movements/monthly-chart.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CategoryBreakdownComponent, DecimalPipe, IonButton, IonContent, IonFab, IonFabButton, IonHeader,
    IonIcon, IonRefresher, IonRefresherContent, IonSkeletonText, IonToolbar, MoneyPipe,
    MonthNavComponent, MonthlyChartComponent, MovementEditorComponent, MovementListComponent,
    RouterLink, WallitLogoComponent,
  ],
})
export class HomePage {
  readonly store = inject(MovementsStore);
  readonly insights = inject(InsightsStore);
  readonly displayName = inject(ProfileStore).displayName;
  readonly editor = viewChild.required(MovementEditorComponent);

  readonly summary = this.store.summary;
  readonly hasIncome = computed(() => this.summary().ingresos > 0);
  readonly recent = computed(() => this.store.list().slice(0, 5));
  readonly change = this.insights.expenseChange;

  constructor() {
    addIcons({ add, arrowDownOutline, arrowUpOutline });
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    this.store.movements.reload();
    this.insights.reload();
    await event.target.complete();
  }
}
