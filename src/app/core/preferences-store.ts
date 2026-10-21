import { DOCUMENT } from '@angular/common';
import { Service, computed, effect, inject, signal } from '@angular/core';
import { currencyForLocale, currencyInfo, CURRENCIES } from './currencies';

export type Language = 'es' | 'en';
export type Theme = 'system' | 'light' | 'dark';

const KEYS = { currency: 'wallit_moneda', language: 'wallit_idioma', theme: 'wallit_tema' } as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function initialLanguage(): Language {
  const stored = read(KEYS.language);
  if (stored === 'es' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

function initialCurrency(): string {
  const stored = read(KEYS.currency);
  if (stored && CURRENCIES.some((c) => c.code === stored)) return stored;
  return currencyForLocale(navigator.language ?? '');
}

function initialTheme(): Theme {
  const stored = read(KEYS.theme);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

@Service()
export class PreferencesStore {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly currency = signal(initialCurrency());
  readonly language = signal<Language>(initialLanguage());
  readonly theme = signal<Theme>(initialTheme());

  readonly currencyInfo = computed(() => currencyInfo(this.currency()));
  readonly locale = computed(() => (this.language() === 'en' ? 'en-US' : 'es-AR'));
  readonly isDark = computed(() => this.theme() === 'dark' || (this.theme() === 'system' && this.systemDark()));

  constructor() {
    this.media?.addEventListener?.('change', (event) => this.systemDark.set(event.matches));

    effect(() => write(KEYS.currency, this.currency()));
    effect(() => write(KEYS.language, this.language()));
    effect(() => write(KEYS.theme, this.theme()));

    effect(() => {
      this.document.documentElement.classList.toggle('ion-palette-dark', this.isDark());
    });
    effect(() => {
      this.document.documentElement.lang = this.language();
    });
  }
}
