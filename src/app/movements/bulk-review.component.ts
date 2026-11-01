import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import {
  IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, sparkles, trashOutline } from 'ionicons/icons';
import { toIsoDate } from '../core/dates';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import type { FuenteIngreso, TipoMovimiento } from '../core/database.types';
import type { AiResult } from '../ai/ai.model';
import { CategoriesStore } from '../categories/categories-store';
import { BulkRow, bulkInputs, bulkReady, bulkTotal, rowIsValid, selectedRows, toBulkRows } from './bulk.model';
import { INCOME_SOURCES, MOVEMENT_TYPES, MovementInput, typeInfo } from './movement.model';

/** Revisión rápida cuando la IA encontró varios movimientos en un mismo audio o texto. */
import { AmountInputComponent } from '../shared/amount-input.component';
@Component({
  selector: 'app-bulk-review',
  host: { class: 'ion-page' },
  imports: [
    AmountInputComponent,
    IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar, MoneyPipe, TranslatePipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'bulkTitle' | t: String(rows().length) }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss.emit()" [attr.aria-label]="'close' | t">
            <ion-icon slot="icon-only" name="close-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="intro">
        <span class="spark" aria-hidden="true"><ion-icon name="sparkles" /></span>
        <div>
          <strong>{{ 'bulkIntro' | t }}</strong>
          @if (result()?.transcript; as transcript) {
            <span>{{ 'aiHeard' | t: transcript }}</span>
          }
        </div>
      </div>

      <ul class="rows">
        @for (row of rows(); track row.key) {
          @let type = typeOf(row.tipo);
          <li class="row" [class.off]="!row.include" [class.invalid]="row.include && !valid(row)" [style.--type-color]="type.color">
            <label class="check">
              <input
                type="checkbox"
                [checked]="row.include"
                [attr.aria-label]="'bulkInclude' | t: row.description"
                (change)="patch(row.key, { include: $any($event.target).checked })"
              />
            </label>

            <select
              class="field type"
              [attr.aria-label]="'movementType' | t"
              [value]="row.tipo"
              (change)="setType(row.key, $any($event.target).value)"
            >
              @for (option of types; track option.id) {
                <option [value]="option.id" [selected]="option.id === row.tipo">{{ option.labelKey | t }}</option>
              }
            </select>

            <input
              class="field description"
              type="text"
              maxlength="120"
              [attr.aria-label]="'description' | t"
              [placeholder]="type.placeholderKey | t"
              [value]="row.description"
              (input)="patch(row.key, { description: $any($event.target).value })"
            />

            @if (row.tipo === 'gasto') {
              <select
                class="field category"
                [attr.aria-label]="'category' | t"
                (change)="patch(row.key, { category: $any($event.target).value })"
              >
                @for (category of categories(); track category.name) {
                  <option [value]="category.name" [selected]="category.name === row.category">
                    {{ category.emoji }} {{ category.label }}
                  </option>
                }
              </select>
            } @else if (row.tipo === 'ingreso') {
              <select
                class="field category"
                [attr.aria-label]="'incomeSource' | t"
                (change)="patch(row.key, { fuente: $any($event.target).value })"
              >
                @for (source of sources; track source.id) {
                  <option [value]="source.id" [selected]="source.id === row.fuente">{{ source.labelKey | t }}</option>
                }
              </select>
            } @else {
              <span class="field category placeholder"></span>
            }

            <input
              class="field date"
              type="date"
              [attr.aria-label]="'date' | t"
              [value]="row.date"
              (input)="patch(row.key, { date: $any($event.target).value })"
            />

            <label class="field amount" [class.missing]="row.include && !valid(row)">
              <span aria-hidden="true">{{ preferences.currencyInfo().symbol }}</span>
              <app-amount-input class="row-amount" [label]="'amount' | t" [value]="row.amount" (valueChange)="setAmount(row.key, $event)" />
            </label>
          </li>
        }
      </ul>

      @if (missing() > 0) {
        <p class="wl-field-error">{{ 'bulkMissing' | t: String(missing()) }}</p>
      }
    </ion-content>

    <ion-footer class="ion-no-border">
      <div class="actions">
        <div class="total">
          <span>{{ 'bulkTotal' | t }}</span>
          <strong [class.positive]="total() > 0">{{ total() > 0 ? '+' : '' }}{{ total() | money }}</strong>
        </div>
        <ion-button class="wl-btn wl-btn-primary" [disabled]="saving() || !ready()" (click)="submit()">
          @if (saving()) {
            <ion-spinner name="crescent" />
          } @else {
            {{ 'bulkSave' | t: String(count()) }}
          }
        </ion-button>
      </div>
    </ion-footer>
  `,
  styles: `
    .intro {
      display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; padding: 14px 16px; border-radius: 16px;
      background: linear-gradient(135deg, rgba(var(--ion-color-primary-rgb), 0.12), rgba(236, 72, 153, 0.08));
    }
    .intro div { display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
    .intro span:not(.spark) { color: var(--wl-muted); }
    .spark {
      flex: none; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: #fff;
      background: linear-gradient(135deg, var(--ion-color-primary), #ec4899);
    }
    .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .row {
      display: grid; gap: 8px; align-items: center; padding: 10px 12px 10px 10px; border-radius: 16px;
      grid-template-columns: auto 120px minmax(0, 1fr) 170px 140px 130px;
      grid-template-areas: 'check type description category date amount';
      background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
      border-left: 4px solid var(--type-color); transition: opacity 0.15s ease;
    }
    .row.off { opacity: 0.45; }
    .check { grid-area: check; display: grid; place-items: center; width: 28px; }
    .check input { width: 18px; height: 18px; accent-color: var(--ion-color-primary); }
    .field {
      min-width: 0; height: 40px; padding: 0 10px; border-radius: 10px; font: inherit; font-size: 14px; color: inherit;
      background: var(--ion-background-color, #fff); border: 1px solid var(--wl-field-border); outline: none;
    }
    .field:focus, .field:focus-within { border-color: var(--ion-color-primary); }
    .type { grid-area: type; font-weight: 600; color: var(--type-color); }
    .description { grid-area: description; }
    .category { grid-area: category; }
    .placeholder { border: 0; background: none; }
    .date { grid-area: date; }
    .amount { grid-area: amount; display: flex; align-items: center; gap: 4px; font-weight: 700; }
    .row-amount { flex: 1; min-width: 0; text-align: right; }
    .amount.missing { border-color: var(--ion-color-danger); }
    @media (max-width: 760px) {
      .row {
        grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
        grid-template-areas: 'check description description' 'check type amount' 'check category date';
      }
      .placeholder { display: none; }
    }
    .wl-field-error { margin-top: 12px; }
    .actions {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 12px 16px calc(12px + var(--ion-safe-area-bottom, 0px));
      border-top: 1px solid var(--wl-field-border);
    }
    .total { display: flex; flex-direction: column; font-size: 13px; color: var(--wl-muted); }
    .total strong { font-size: 18px; color: var(--ion-text-color); font-variant-numeric: tabular-nums; }
    .total strong.positive { color: var(--wl-type-ingreso); }
  `,
})
export class BulkReviewComponent {
  readonly preferences = inject(PreferencesStore);
  private readonly i18n = inject(I18n);
  private readonly categoriesStore = inject(CategoriesStore);

  readonly result = input<AiResult | null>(null);
  readonly saving = input(false);
  readonly save = output<MovementInput[]>();
  readonly dismiss = output<void>();

  readonly String = String;
  readonly types = MOVEMENT_TYPES;
  readonly sources = INCOME_SOURCES;

  readonly categories = computed(() =>
    this.categoriesStore.visible().map((c) => ({ name: c.name, emoji: c.emoji, label: this.i18n.category(c.name) })),
  );

  readonly rows = linkedSignal<BulkRow[]>(() =>
    toBulkRows(this.result()?.movements ?? [], this.categories().map((c) => c.name), toIsoDate(new Date())),
  );

  readonly count = computed(() => selectedRows(this.rows()).length);
  readonly total = computed(() => bulkTotal(this.rows()));
  readonly ready = computed(() => bulkReady(this.rows()));
  readonly missing = computed(() => selectedRows(this.rows()).filter((row) => !rowIsValid(row)).length);

  constructor() {
    addIcons({ closeOutline, sparkles, trashOutline });
  }

  typeOf(id: TipoMovimiento) {
    return typeInfo(id);
  }

  valid(row: BulkRow): boolean {
    return rowIsValid(row);
  }

  patch(key: number, changes: Partial<BulkRow>): void {
    this.rows.update((rows) => rows.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  setType(key: number, tipo: TipoMovimiento): void {
    this.patch(key, { tipo, fuente: tipo === 'ingreso' ? ('otro' as FuenteIngreso) : null });
  }

  setAmount(key: number, amount: number | null): void {
    this.patch(key, { amount });
  }

  submit(): void {
    if (this.ready()) this.save.emit(bulkInputs(this.rows()));
  }
}
