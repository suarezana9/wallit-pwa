import { Component, computed, inject, output, signal } from '@angular/core';
import { AlertController, IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmark, chevronForward } from 'ionicons/icons';
import type { Recurrente } from '../core/database.types';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import { CategoriesStore } from '../categories/categories-store';
import { typeInfo } from './movement.model';
import { RecurringStore } from './recurring-store';

/**
 * Inicio: "Fijos de noviembre". Cada fijo del mes se confirma con un toque (o se toca el monto para cambiarlo,
 * como la luz que viene distinta cada mes) o se saltea. Si no queda ninguno pendiente, no ocupa lugar.
 */
import { amountForClipboard, parseAmount } from '../core/amount';
@Component({
  selector: 'app-recurring-pending',
  imports: [IonIcon, IonSpinner, MoneyPipe, TranslatePipe],
  template: `
    @if (items().length) {
      <section class="panel" aria-labelledby="fixed-title">
        <header>
          <div>
            <h2 id="fixed-title">{{ 'fixedPendingTitle' | t: monthName() }}</h2>
            <p>{{ 'fixedPendingHint' | t }}</p>
          </div>
          @if (items().length > 1) {
            <button type="button" class="all" [disabled]="busy() !== null" (click)="confirmAll()">
              @if (busy() === 'all') {
                <ion-spinner name="crescent" />
              }
              {{ 'confirmAll' | t }}
            </button>
          }
        </header>
        <ul>
          @for (item of items(); track item.r.id) {
            <li>
              <span class="avatar" [style.--c]="item.color" aria-hidden="true">{{ item.emoji }}</span>
              <span class="text">
                <strong>{{ item.title }}</strong>
                <span>{{ 'fixedDay' | t: '' + item.r.dia }} · <button type="button" class="skip" (click)="skip(item.r)">{{ 'skipMonth' | t }}</button></span>
              </span>
              <button type="button" class="amount" [class.income]="item.r.tipo === 'ingreso'" (click)="editAmount(item.r)" [attr.aria-label]="'changeAmount' | t">
                {{ item.r.amount | money }}
              </button>
              <button type="button" class="ok" [disabled]="busy() !== null" (click)="confirm(item.r)" [attr.aria-label]="'confirm' | t">
                @if (busy() === item.r.id) {
                  <ion-spinner name="crescent" />
                } @else {
                  <ion-icon name="checkmark" />
                }
              </button>
            </li>
          }
        </ul>
        <button type="button" class="manage" (click)="manage.emit()">
          {{ 'manageFixed' | t }} <ion-icon name="chevron-forward" aria-hidden="true" />
        </button>
      </section>
    }
  `,
  styles: `
    :host { display: block; }
    .panel {
      padding: 14px 16px 8px; border-radius: 18px;
      background: color-mix(in srgb, var(--ion-color-primary) 5%, var(--ion-background-color, #fff));
      border: 1px solid rgba(var(--ion-color-primary-rgb), 0.22);
    }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
    h2 { margin: 0; font-size: 15px; font-weight: 700; }
    header p { margin: 2px 0 0; font-size: 12px; color: var(--wl-muted); }
    .all {
      flex: none; display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px;
      font: inherit; font-size: 13px; font-weight: 700; color: #fff; background: var(--ion-color-primary); border: 0; cursor: pointer;
    }
    .all ion-spinner { width: 14px; height: 14px; color: #fff; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--wl-field-border); }
    li:first-child { border-top: 0; }
    .avatar {
      flex: none; width: 36px; height: 36px; border-radius: 11px; display: grid; place-items: center; font-size: 18px;
      background: color-mix(in srgb, var(--c) 14%, transparent);
    }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .text strong { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .text > span { font-size: 12px; color: var(--wl-muted); }
    .skip { padding: 0; border: 0; background: none; font: inherit; color: var(--wl-muted); text-decoration: underline; cursor: pointer; }
    .amount {
      flex: none; padding: 6px 10px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 700;
      font-variant-numeric: tabular-nums; color: var(--ion-text-color); cursor: pointer;
      background: var(--ion-background-color, #fff); border: 1px dashed var(--wl-field-border);
    }
    .amount.income { color: var(--wl-type-ingreso); }
    .ok {
      flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 20px;
      color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.12); border: 0; cursor: pointer;
    }
    .ok ion-spinner { width: 16px; height: 16px; }
    .manage {
      display: inline-flex; align-items: center; gap: 2px; margin-top: 2px; padding: 6px 0; border: 0; background: none;
      font: inherit; font-size: 13px; font-weight: 600; color: var(--ion-color-primary); cursor: pointer;
    }
  `,
})
export class RecurringPendingComponent {
  private readonly store = inject(RecurringStore);
  private readonly categories = inject(CategoriesStore);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly manage = output<void>();
  readonly busy = signal<string | null>(null);

  readonly items = computed(() =>
    this.store.pending().map((r) => {
      if (r.tipo === 'gasto') {
        const c = this.categories.info(r.category);
        return { r, emoji: c.emoji, color: c.color, title: r.description || this.i18n.category(c.name) };
      }
      const type = typeInfo(r.tipo);
      return { r, emoji: r.tipo === 'ingreso' ? '💰' : '🏦', color: type.color, title: r.description || this.i18n.t(type.labelKey) };
    }),
  );

  readonly monthName = computed(() => {
    const [y, m] = this.store.month().split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(this.preferences.locale(), { month: 'long' });
  });

  constructor() {
    addIcons({ checkmark, chevronForward });
  }

  async confirm(r: Recurrente, amount?: number): Promise<void> {
    this.busy.set(r.id);
    const error = await this.store.confirm(r, amount);
    this.busy.set(null);
    await this.toast(error ?? this.i18n.t('fixedConfirmed'), !!error);
  }

  async confirmAll(): Promise<void> {
    const list = this.store.pending();
    this.busy.set('all');
    const error = await this.store.confirmAll(list);
    this.busy.set(null);
    await this.toast(error ?? this.i18n.t('savedMany', String(list.length)), !!error);
  }

  async skip(r: Recurrente): Promise<void> {
    const error = await this.store.skip(r);
    await this.toast(error ?? this.i18n.t('fixedSkipped', this.monthName()), !!error);
  }

  /** Servicios que cambian de monto: se escribe el de este mes y se confirma. */
  async editAmount(r: Recurrente): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('amountThisMonth'),
      inputs: [{ name: 'amount', type: 'text', value: amountForClipboard(Number(r.amount), this.preferences.language()), attributes: { inputmode: 'decimal' } }],
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        {
          text: this.i18n.t('confirm'),
          handler: (data: { amount: string }) => {
            const amount = parseAmount(data.amount, this.preferences.language());
            if (amount === null || !(amount > 0)) return false;
            void this.confirm(r, amount);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async toast(message: string, danger = false): Promise<void> {
    const toast = await this.toasts.create({ message, color: danger ? 'danger' : 'dark', duration: 2000, position: 'top' });
    await toast.present();
  }
}
