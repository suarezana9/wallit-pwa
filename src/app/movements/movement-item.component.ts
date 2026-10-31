import { Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowDownOutline, attachOutline, cardOutline, lockClosed, trendingUpOutline, walletOutline } from 'ionicons/icons';
import { relativeDate } from '../core/dates';
import { MoneyPipe } from '../core/money';
import { I18n } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import type { Movimiento } from '../core/database.types';
import { CategoriesStore } from '../categories/categories-store';
import { incomeSourceKey, paymentMethodKey, typeInfo } from './movement.model';

@Component({
  selector: 'app-movement-item',
  imports: [IonIcon, MoneyPipe],
  template: `
    <div class="avatar" [style.--avatar-color]="view().color" aria-hidden="true">
      @if (view().emoji; as emoji) {
        <span>{{ emoji }}</span>
      } @else {
        <ion-icon [name]="view().icon" />
      }
    </div>
    <div class="text">
      <span class="title">{{ view().title }}</span>
      <span class="subtitle">
        @if (movement().is_private) {
          <ion-icon name="lock-closed" class="lock" aria-hidden="true" />
        }
        @if (movement().receipt_url) {
          <ion-icon name="attach-outline" class="lock clip" [attr.aria-label]="receiptLabel()" role="img" />
        }
        {{ view().subtitle }}
      </span>
    </div>
    <span class="amount" [class.positive]="view().isIncome" [style.color]="view().amountColor">
      {{ view().isIncome ? '+' : '' }}{{ movement().amount | money }}
    </span>
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 12px; width: 100%; padding: 6px 0; }
    .avatar {
      flex: none; width: 42px; height: 42px; border-radius: 12px;
      display: grid; place-items: center; font-size: 20px;
      color: var(--avatar-color);
      background: color-mix(in srgb, var(--avatar-color) 14%, transparent);
    }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .subtitle { font-size: 13px; color: var(--wl-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lock { font-size: 11px; vertical-align: -1px; margin-right: 2px; }
    .clip { font-size: 13px; vertical-align: -2px; color: var(--ion-color-primary); }
    .amount { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  `,
})
export class MovementItemComponent {
  readonly movement = input.required<Movimiento>();
  readonly author = input<string | null>(null);
  readonly showDate = input(true);
  private readonly i18n = inject(I18n);
  private readonly categories = inject(CategoriesStore);
  private readonly preferences = inject(PreferencesStore);

  constructor() {
    addIcons({ arrowDownOutline, attachOutline, cardOutline, lockClosed, trendingUpOutline, walletOutline });
  }

  readonly receiptLabel = computed(() => this.i18n.t('receipt'));

  /** "Cuota 3/12", "🔁 Fijo" o el medio de pago. */
  private extra(m: Movimiento): string {
    if (m.cuota_num && m.cuotas_total) return this.i18n.t('installmentShort', `${m.cuota_num}/${m.cuotas_total}`);
    if (m.recurrente_id) return `🔁 ${this.i18n.t('fixedShort')}`;
    return this.payment(m.medio_pago);
  }

  private payment(id: string | null): string {
    const key = paymentMethodKey(id);
    return key ? this.i18n.t(key) : '';
  }

  readonly view = computed(() => {
    const m = this.movement();
    const date = !this.showDate() ? '' : relativeDate(m.date, new Date(), this.preferences.locale(), {
      today: this.i18n.t('today'),
      yesterday: this.i18n.t('yesterday'),
    });
    if (m.tipo === 'gasto') {
      const category = this.categories.info(m.category);
      const name = this.i18n.category(category.name);
      return {
        emoji: category.emoji,
        icon: '',
        color: category.color,
        title: m.description || name,
        subtitle: [name, this.extra(m), this.author(), date].filter(Boolean).join(' · '),
        isIncome: false,
        amountColor: null,
      };
    }
    if (m.tipo === 'pago_tarjeta') {
      const label = this.i18n.t('typePagoTarjeta');
      return {
        emoji: '💳',
        icon: '',
        color: '#0F766E',
        title: m.description || label,
        subtitle: [label, this.i18n.t('notCounted'), this.author(), date].filter(Boolean).join(' · '),
        isIncome: false,
        amountColor: 'var(--wl-muted)',
      };
    }
    const type = typeInfo(m.tipo);
    const label = this.i18n.t(type.labelKey);
    const sourceKey = m.tipo === 'ingreso' ? incomeSourceKey(m.fuente) : null;
    const source = sourceKey ? this.i18n.t(sourceKey) : '';
    return {
      emoji: '',
      icon: type.icon,
      color: type.color,
      title: m.description || label,
      subtitle: [label, source, this.extra(m), this.author(), date].filter(Boolean).join(' · '),
      isIncome: m.tipo === 'ingreso',
      amountColor: type.color,
    };
  });
}
