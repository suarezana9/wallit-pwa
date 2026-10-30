import { Component, computed, inject } from '@angular/core';
import { IonButton, IonIcon, IonSpinner, IonToggle, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { notificationsOutline, notificationsOffOutline, shareOutline } from 'ionicons/icons';
import { I18n, TranslatePipe, TranslationKey } from '../core/i18n/i18n';
import { NOTIF_PREFS, NotifPref, PushStatus } from './notification.model';
import { PushService } from './push.service';

const PREF_LABELS: Record<NotifPref, { title: TranslationKey; hint: TranslationKey }> = {
  gasto_grupo: { title: 'prefGroupExpenses', hint: 'prefGroupExpensesHint' },
  pagos: { title: 'prefPayments', hint: 'prefPaymentsHint' },
  presupuesto: { title: 'prefBudgets', hint: 'prefBudgetsHint' },
  deudas: { title: 'prefDebts', hint: 'prefDebtsHint' },
};

const STATUS_TEXT: Record<PushStatus, TranslationKey> = {
  unconfigured: 'pushUnconfigured',
  dev: 'pushDev',
  unsupported: 'pushUnsupported',
  'install-ios': 'pushInstallIos',
  denied: 'pushDeniedHint',
  off: 'pushOffHint',
  on: 'pushOnHint',
};

/** Sección "Notificaciones" de Cuenta: activar en este dispositivo y elegir qué avisos recibir. */
@Component({
  selector: 'app-notification-settings',
  imports: [IonButton, IonIcon, IonSpinner, IonToggle, TranslatePipe],
  template: `
    <section class="wl-panel" aria-labelledby="notif-title">
      <h2 id="notif-title">{{ 'notifications' | t }}</h2>

      <div class="device" [class.on]="status() === 'on'">
        <span class="icon" aria-hidden="true">
          <ion-icon [name]="status() === 'on' ? 'notifications-outline' : 'notifications-off-outline'" />
        </span>
        <div class="text">
          <span class="label">{{ 'pushThisDevice' | t }}</span>
          <p class="hint">{{ statusText() | t }}</p>
        </div>
        @if (push.busy()) {
          <ion-spinner name="crescent" />
        } @else if (status() === 'off') {
          <ion-button class="wl-btn wl-btn-primary" size="small" (click)="enable()">{{ 'pushEnable' | t }}</ion-button>
        } @else if (status() === 'on') {
          <div class="actions">
            <ion-button class="wl-btn" size="small" fill="outline" (click)="push.test()">{{ 'pushTest' | t }}</ion-button>
            <ion-button class="wl-btn" size="small" fill="clear" color="medium" (click)="push.disable()">{{ 'pushDisable' | t }}</ion-button>
          </div>
        }
      </div>

      <p class="section-hint">{{ 'notifPrefsHint' | t }}</p>
      <ul class="prefs">
        @for (pref of prefs; track pref) {
          <li>
            <div class="text">
              <span class="label">{{ labels[pref].title | t }}</span>
              <p class="hint">{{ labels[pref].hint | t }}</p>
            </div>
            <ion-toggle
              [checked]="push.wants(pref)"
              [disabled]="!push.prefs.hasValue()"
              [attr.aria-label]="labels[pref].title | t"
              (ionChange)="setPref(pref, $event.detail.checked)"
            />
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    h2 { margin: 0 0 12px; font-size: 17px; }
    .device {
      display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px;
      background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
    }
    .device.on { background: rgba(var(--ion-color-primary-rgb), 0.07); border-color: rgba(var(--ion-color-primary-rgb), 0.25); }
    .icon {
      flex: none; width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; font-size: 20px;
      color: var(--wl-muted); background: var(--ion-background-color, #fff);
    }
    .device.on .icon { color: #fff; background: var(--ion-color-primary); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .label { font-weight: 600; font-size: 15px; }
    .hint { margin: 0; font-size: 13px; color: var(--wl-muted); line-height: 1.4; }
    .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
    .section-hint { margin: 18px 0 6px; font-size: 13px; color: var(--wl-muted); }
    .prefs { list-style: none; margin: 0; padding: 0; }
    .prefs li { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--wl-field-border); }
    .prefs li:last-child { border-bottom: 0; }
  `,
})
export class NotificationSettingsComponent {
  readonly push = inject(PushService);
  private readonly i18n = inject(I18n);
  private readonly toasts = inject(ToastController);

  readonly prefs = NOTIF_PREFS;
  readonly labels = PREF_LABELS;
  readonly status = this.push.status;
  readonly statusText = computed(() => STATUS_TEXT[this.status()]);

  constructor() {
    addIcons({ notificationsOutline, notificationsOffOutline, shareOutline });
  }

  async enable(): Promise<void> {
    const error = await this.push.enable();
    await this.toast(error ?? this.i18n.t('pushEnabled'), error ? 'danger' : 'dark');
  }

  async setPref(pref: NotifPref, value: boolean): Promise<void> {
    const error = await this.push.setPref(pref, value);
    if (error) await this.toast(error, 'danger');
  }

  private async toast(message: string, color: 'dark' | 'danger'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2600, position: 'top' });
    await toast.present();
  }
}
