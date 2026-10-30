import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonIcon, IonSelect, IonSelectOption, IonTitle, IonToolbar,
  SelectCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, chevronForward, logOutOutline } from 'ionicons/icons';
import { AuthStore } from '../core/auth-store';
import { CURRENCIES } from '../core/currencies';
import { TranslatePipe, TranslationKey } from '../core/i18n/i18n';
import { Language, PreferencesStore, Theme } from '../core/preferences-store';
import { ProfileStore } from '../core/profile-store';

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
    IonButton, IonContent, IonHeader, IonIcon, IonSelect, IonSelectOption, IonTitle, IonToolbar, RouterLink, TranslatePipe,
  ],
  templateUrl: 'account.page.html',
  styleUrls: ['account.page.scss'],
})
export class AccountPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly preferences = inject(PreferencesStore);
  readonly displayName = inject(ProfileStore).displayName;
  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly initial = computed(() => (this.displayName() || this.email()).charAt(0).toUpperCase());

  readonly themes = THEMES;
  readonly languages = LANGUAGES;

  readonly currencyOptions = computed(() => {
    const language = this.preferences.language();
    return CURRENCIES.map((c) => ({ code: c.code, label: `${c.code} · ${c.name[language]}` }));
  });

  constructor() {
    addIcons({ checkmarkCircle, chevronForward, logOutOutline });
  }

  onCurrency(event: SelectCustomEvent<string>): void {
    if (event.detail.value) this.preferences.currency.set(event.detail.value);
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
