import { Component, computed, inject, signal } from '@angular/core';
import {
  AlertController, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, trashOutline } from 'ionicons/icons';
import type { Recurrente } from '../core/database.types';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { CategoriesStore } from '../categories/categories-store';
import { GroupsStore } from '../groups/groups-store';
import { typeInfo } from './movement.model';
import { RecurringStore } from './recurring-store';

/** Lista de fijos: pausar, cambiar monto o día, borrar. Se abre desde Inicio y desde Cuenta. */
import { amountForClipboard, parseAmount } from '../core/amount';
import { PreferencesStore } from '../core/preferences-store';
@Component({
  selector: 'app-recurring-manager',
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar, MoneyPipe, TranslatePipe],
  template: `
    <ion-modal class="wl-dialog wl-dialog-form" [isOpen]="isOpen()" (didDismiss)="isOpen.set(false)">
      <ng-template>
        <div class="ion-page">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ 'fixedTitle' | t }}</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="isOpen.set(false)" [attr.aria-label]="'close' | t">
                  <ion-icon slot="icon-only" name="close-outline" />
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            <p class="intro">{{ 'fixedIntro' | t }}</p>
            @for (item of items(); track item.r.id) {
              <div class="row" [class.paused]="!item.r.activo">
                <span class="avatar" [style.--c]="item.color" aria-hidden="true">{{ item.emoji }}</span>
                <span class="text">
                  <strong>{{ item.title }}</strong>
                  <span>
                    {{ 'fixedDay' | t: '' + item.r.dia }} · {{ item.space }}
                    @if (!item.r.activo) {
                      · {{ 'paused' | t }}
                    }
                  </span>
                </span>
                <button type="button" class="amount" (click)="edit(item.r)" [attr.aria-label]="'changeAmount' | t">{{ item.r.amount | money }}</button>
                <button
                  type="button"
                  class="switch"
                  role="switch"
                  [class.on]="item.r.activo"
                  [attr.aria-checked]="item.r.activo"
                  [attr.aria-label]="'fixedActive' | t"
                  (click)="toggle(item.r)"
                ><span></span></button>
                <button type="button" class="delete" (click)="remove(item.r)" [attr.aria-label]="'delete' | t">
                  <ion-icon name="trash-outline" />
                </button>
              </div>
            } @empty {
              <div class="empty">
                <span aria-hidden="true">🔁</span>
                <strong>{{ 'fixedEmpty' | t }}</strong>
                <p>{{ 'fixedEmptyHint' | t }}</p>
              </div>
            }
          </ion-content>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .intro { margin: 0 0 14px; font-size: 14px; line-height: 1.45; color: var(--wl-muted); }
    .row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--wl-field-border); }
    .row.paused .avatar, .row.paused .text, .row.paused .amount { opacity: 0.5; }
    .avatar {
      flex: none; width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; font-size: 18px;
      background: color-mix(in srgb, var(--c) 14%, transparent);
    }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .text strong { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .text span { font-size: 12px; color: var(--wl-muted); }
    .amount {
      flex: none; padding: 6px 10px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;
      color: inherit; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border); cursor: pointer;
    }
    .switch {
      flex: none; position: relative; width: 40px; height: 24px; padding: 0; border-radius: 999px; border: 0; cursor: pointer;
      background: var(--wl-field-border); transition: background 0.15s ease;
    }
    .switch span {
      position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform 0.15s ease;
    }
    .switch.on { background: var(--ion-color-primary); }
    .switch.on span { transform: translateX(16px); }
    .delete { flex: none; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; background: none; font-size: 18px; color: var(--wl-muted); cursor: pointer; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 32px 12px; text-align: center; }
    .empty span { font-size: 30px; }
    .empty p { margin: 0; font-size: 13px; line-height: 1.45; color: var(--wl-muted); }
  `,
})
export class RecurringManagerComponent {
  private readonly store = inject(RecurringStore);
  private readonly categories = inject(CategoriesStore);
  private readonly groups = inject(GroupsStore);
  private readonly i18n = inject(I18n);
  private readonly preferences = inject(PreferencesStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly isOpen = signal(false);

  readonly items = computed(() =>
    this.store.list().map((r) => {
      const space = r.group_id ? (this.groups.list().find((g) => g.group.id === r.group_id)?.group.name ?? '—') : this.i18n.t('personal');
      if (r.tipo === 'gasto') {
        const c = this.categories.info(r.category);
        return { r, space, emoji: c.emoji, color: c.color, title: r.description || this.i18n.category(c.name) };
      }
      const type = typeInfo(r.tipo);
      return { r, space, emoji: r.tipo === 'ingreso' ? '💰' : '🏦', color: type.color, title: r.description || this.i18n.t(type.labelKey) };
    }),
  );

  constructor() {
    addIcons({ closeOutline, trashOutline });
  }

  open(): void {
    this.isOpen.set(true);
  }

  async toggle(r: Recurrente): Promise<void> {
    const error = await this.store.update(r.id, { activo: !r.activo });
    if (error) await this.toast(error);
  }

  async edit(r: Recurrente): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('fixedEdit'),
      inputs: [
        { name: 'amount', type: 'text', value: amountForClipboard(Number(r.amount), this.preferences.language()), placeholder: this.i18n.t('amount'), attributes: { inputmode: 'decimal' } },
        { name: 'dia', type: 'number', value: r.dia, min: 1, max: 31, placeholder: this.i18n.t('dayOfMonth'), attributes: { inputmode: 'numeric' } },
      ],
      message: this.i18n.t('fixedEditHint'),
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        {
          text: this.i18n.t('save'),
          handler: (data: { amount: string; dia: string }) => {
            const amount = parseAmount(data.amount, this.preferences.language()) ?? 0;
            const dia = Math.round(Number(data.dia));
            if (!(amount > 0) || !(dia >= 1 && dia <= 31)) return false;
            void this.saveEdit(r.id, amount, dia);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async remove(r: Recurrente): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('fixedDeleteTitle'),
      message: this.i18n.t('fixedDeleteText'),
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        { text: this.i18n.t('delete'), role: 'destructive', handler: () => void this.doRemove(r.id) },
      ],
    });
    await alert.present();
  }

  private async saveEdit(id: string, amount: number, dia: number): Promise<void> {
    const error = await this.store.update(id, { amount, dia });
    if (error) await this.toast(error);
  }

  private async doRemove(id: string): Promise<void> {
    const error = await this.store.remove(id);
    if (error) await this.toast(error);
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, color: 'danger', duration: 2200, position: 'top' });
    await toast.present();
  }
}
