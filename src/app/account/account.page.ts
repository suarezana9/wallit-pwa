import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonIcon, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
  AlertController, SelectCustomEvent, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  camera, chatbubbleEllipsesOutline, checkmarkCircle, chevronForward, documentTextOutline, logOutOutline, shieldCheckmarkOutline, trashOutline,
} from 'ionicons/icons';
import { AuthStore } from '../core/auth-store';
import { CURRENCIES } from '../core/currencies';
import { I18n, TranslatePipe, TranslationKey } from '../core/i18n/i18n';
import { Language, PreferencesStore, Theme } from '../core/preferences-store';
import { ProfileStore } from '../core/profile-store';
import { NotificationSettingsComponent } from '../notifications/notification-settings.component';
import { RecurringManagerComponent } from '../movements/recurring-manager.component';
import { AiUsageComponent } from '../ai/ai-usage.component';
import { PayoutSettingsComponent } from './payout-settings.component';
import { AvatarComponent } from '../shared/avatar.component';
import { AccountService } from './account.service';
import { FeedbackDialogComponent } from './feedback-dialog.component';

interface ThemeOption {
  id: Theme;
  labelKey: TranslationKey;
}

const THEMES: readonly ThemeOption[] = [
  { id: 'system', labelKey: 'themeSystem' },
  { id: 'light', labelKey: 'themeLight' },
  { id: 'dark', labelKey: 'themeDark' },
];

const LANGUAGES: readonly { id: Language; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];

@Component({
  selector: 'app-account',
  imports: [
    AiUsageComponent, AvatarComponent, FeedbackDialogComponent,
    PayoutSettingsComponent,
    IonButton, IonContent, IonHeader, IonIcon, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar, NotificationSettingsComponent,
    RecurringManagerComponent, RouterLink, TranslatePipe,
  ],
  templateUrl: 'account.page.html',
  styleUrls: ['account.page.scss'],
})
export class AccountPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly preferences = inject(PreferencesStore);
  private readonly profile = inject(ProfileStore);
  private readonly i18n = inject(I18n);
  private readonly toasts = inject(ToastController);
  readonly displayName = this.profile.displayName;
  readonly avatarUrl = this.profile.avatarUrl;
  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly photoBusy = signal(false);
  readonly deleting = signal(false);
  private readonly account = inject(AccountService);
  private readonly alerts = inject(AlertController);
  readonly avatarSize = typeof matchMedia === 'function' && matchMedia('(min-width: 992px)').matches ? 88 : 64;

  readonly themes = THEMES;
  readonly languages = LANGUAGES;

  readonly currencyOptions = computed(() => {
    const language = this.preferences.language();
    return CURRENCIES.map((c) => ({ code: c.code, label: `${c.code} · ${c.name[language]}` }));
  });

  constructor() {
    addIcons({ camera, chatbubbleEllipsesOutline, checkmarkCircle, chevronForward, documentTextOutline, logOutOutline, shieldCheckmarkOutline, trashOutline });
  }

  onCurrency(event: SelectCustomEvent<string>): void {
    if (event.detail.value) this.preferences.chooseCurrency(event.detail.value);
  }

  async onPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.photoBusy.set(true);
    const ok = await this.profile.setAvatar(file);
    this.photoBusy.set(false);
    await this.toast(ok ? 'photoSaved' : 'photoError', ok);
  }

  async removePhoto(): Promise<void> {
    this.photoBusy.set(true);
    const ok = await this.profile.removeAvatar();
    this.photoBusy.set(false);
    if (!ok) await this.toast('photoError', false);
  }

  private async toast(key: 'photoSaved' | 'photoError' | 'deleteAccountError' | 'deleteAccountDone', ok: boolean): Promise<void> {
    const toast = await this.toasts.create({ message: this.i18n.t(key), duration: 2200, position: 'top', color: ok ? 'dark' : 'danger' });
    await toast.present();
  }

  /** Pide escribir ELIMINAR (o DELETE) para que no se borre la cuenta por un toque sin querer. */
  async confirmDelete(): Promise<void> {
    const word = this.i18n.t('deleteAccountWord');
    const alert = await this.alerts.create({
      header: this.i18n.t('deleteAccountConfirm'),
      message: this.i18n.t('deleteAccountText', word),
      inputs: [{ name: 'word', type: 'text', placeholder: word, attributes: { autocapitalize: 'characters', autocomplete: 'off' } }],
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        {
          text: this.i18n.t('deleteAccount'),
          role: 'destructive',
          cssClass: 'wl-alert-danger',
          handler: (values: { word?: string }) => {
            if ((values.word ?? '').trim().toUpperCase() !== word) return false;
            void this.deleteAccount();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async deleteAccount(): Promise<void> {
    this.deleting.set(true);
    const ok = await this.account.deleteAccount();
    this.deleting.set(false);
    if (!ok) {
      await this.toast('deleteAccountError', false);
      return;
    }
    await this.router.navigateByUrl('/login', { replaceUrl: true });
    await this.toast('deleteAccountDone', true);
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
