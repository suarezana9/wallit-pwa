import { Component, computed, inject, output, signal } from '@angular/core';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, pencilOutline } from 'ionicons/icons';
import { CategoriesStore } from '../categories/categories-store';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe, formatMoney } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import { GroupsStore } from '../groups/groups-store';
import { MovementListComponent } from '../movements/movement-list.component';
import { MovementsStore } from '../movements/movements-store';
import type { Budget } from './budget.model';
import { dailyAllowance } from './budget.model';
import { BudgetsStore } from './budgets-store';

@Component({
  selector: 'app-budget-detail',
  imports: [
    IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar, MoneyPipe,
    MovementListComponent, TranslatePipe,
  ],
  template: `
    <ion-modal class="wl-dialog" [isOpen]="!!budgetId()" (didDismiss)="close()">
      <ng-template>
        <div class="ion-page">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ progress()?.budget?.name }}</ion-title>
              <ion-buttons slot="end">
                @if (store.canEdit() && progress(); as p) {
                  <ion-button (click)="edit.emit(p.budget)">
                    <ion-icon slot="start" name="pencil-outline" />
                    {{ 'edit' | t }}
                  </ion-button>
                }
                <ion-button (click)="close()" [attr.aria-label]="'close' | t">
                  <ion-icon slot="icon-only" name="close-outline" />
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            @if (progress(); as p) {
              <div class="layout">
                <div class="col">
                  <section class="hero" [class]="'hero status-' + p.status">
                    <div class="hero-top">
                      <span class="spent">{{ p.spent | money }}</span>
                      <span class="badge">{{ p.status === 'over' ? ('overBadge' | t) : percentLabel(p.percent) }}</span>
                    </div>
                    <span class="of">{{ 'budgetOf' | t: format(p.limit) }}</span>
                    <div class="bar"><span [style.width.%]="p.percent > 100 ? 100 : p.percent"></span></div>
                    <span class="left">
                      {{ p.remaining >= 0 ? ('budgetLeft' | t: format(p.remaining)) : ('budgetOver' | t: format(-p.remaining)) }}
                    </span>
                    @if (daily(); as amount) {
                      <span class="daily">{{ 'perDay' | t: format(amount) }}</span>
                    }
                  </section>

                  <section class="block">
                    <h3>{{ 'budgetBreakdown' | t }}</h3>
                    @for (row of p.byCategory; track row.name) {
                      <div class="cat">
                        <div class="cat-head">
                          <span><span aria-hidden="true">{{ categories.info(row.name).emoji }}</span> {{ i18n.category(row.name) }}</span>
                          <span class="cat-amount">{{ row.amount | money }}</span>
                        </div>
                        <div class="cat-bar">
                          <span [style.width.%]="p.spent ? (row.amount / p.spent) * 100 : 0" [style.background]="categories.info(row.name).color"></span>
                        </div>
                      </div>
                    } @empty {
                      <p class="empty">{{ 'noBudgetSpending' | t }}</p>
                    }
                    <div class="chips">
                      @for (name of p.budget.categories; track name) {
                        <span class="chip">{{ categories.info(name).emoji }} {{ i18n.category(name) }}</span>
                      }
                    </div>
                  </section>
                </div>

                <section class="block col">
                  <h3>{{ 'budgetTransactions' | t }}</h3>
                  <app-movement-list
                    [movements]="transactions()"
                    [readonly]="true"
                    [authors]="groups.activeGroupId() ? groups.memberNames() : null"
                    [emptyTitle]="'noBudgetSpending' | t"
                  />
                </section>
              </div>
            }
          </ion-content>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .layout { display: flex; flex-direction: column; gap: 20px; }
    .col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
    .hero {
      --tone: var(--ion-color-primary);
      display: flex; flex-direction: column; gap: 6px; padding: 18px 20px; border-radius: 18px;
      background: color-mix(in srgb, var(--tone) 9%, transparent); border: 1px solid color-mix(in srgb, var(--tone) 25%, transparent);
    }
    .hero.status-warning { --tone: #d97706; }
    .hero.status-over { --tone: #dc2626; }
    .hero-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .spent { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .badge { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--tone); background: color-mix(in srgb, var(--tone) 15%, transparent); }
    .of { color: var(--wl-muted); font-size: 14px; }
    .bar { height: 10px; margin: 6px 0 2px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 15%, transparent); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: inherit; background: var(--tone); }
    .left { font-weight: 600; color: var(--tone); font-size: 14px; }
    .daily { font-size: 13px; color: var(--wl-muted); }
    .block h3 { margin: 0 0 12px; font-size: 15px; font-weight: 700; }
    .cat { margin-bottom: 12px; }
    .cat-head { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; }
    .cat-amount { font-variant-numeric: tabular-nums; color: var(--wl-muted); }
    .cat-bar { height: 6px; border-radius: 999px; background: var(--wl-field-bg); overflow: hidden; }
    .cat-bar span { display: block; height: 100%; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
    .chip { padding: 4px 10px; border-radius: 999px; font-size: 12px; background: var(--wl-field-bg); color: var(--wl-muted); }
    .empty { margin: 0 0 8px; color: var(--wl-muted); font-size: 14px; }
    @media (min-width: 768px) {
      .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; align-items: start; }
    }
  `,
})
export class BudgetDetailComponent {
  readonly store = inject(BudgetsStore);
  readonly categories = inject(CategoriesStore);
  readonly groups = inject(GroupsStore);
  readonly i18n = inject(I18n);
  private readonly movements = inject(MovementsStore);
  private readonly preferences = inject(PreferencesStore);

  readonly edit = output<Budget>();
  readonly budgetId = signal<string | null>(null);

  readonly progress = computed(() => this.store.progress().find((p) => p.budget.id === this.budgetId()) ?? null);

  readonly transactions = computed(() => {
    const p = this.progress();
    if (!p) return [];
    const set = new Set(p.budget.categories);
    return this.movements.list().filter((m) => m.tipo === 'gasto' && set.has(m.category));
  });

  readonly daily = computed(() => {
    const p = this.progress();
    if (!p || this.movements.monthOffset() !== 0) return null;
    return dailyAllowance(p.remaining);
  });

  constructor() {
    addIcons({ closeOutline, pencilOutline });
  }

  open(budget: Budget): void {
    this.budgetId.set(budget.id);
  }

  close(): void {
    this.budgetId.set(null);
  }

  format(amount: number): string {
    return formatMoney(amount, this.preferences.currency());
  }

  percentLabel(percent: number): string {
    return `${Math.round(percent)}%`;
  }
}
