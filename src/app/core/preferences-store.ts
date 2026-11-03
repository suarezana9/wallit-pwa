import { DOCUMENT } from '@angular/common';
import { Service, computed, effect, inject, signal } from '@angular/core';
import { currencyInfo, resolveCurrency } from './currencies';

export type Language = 'es' | 'en';
export type Theme = 'system' | 'light' | 'dark';

const KEYS = { currency: 'wallit_moneda', language: 'wallit_idioma', theme: 'wallit_tema' } as const;
/** "1" cuando la persona eligió la moneda a mano en Cuenta (si no, se puede volver a adivinar). */
const CURRENCY_CHOSEN_KEY = 'wallit_moneda_elegida';

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
  let timeZone = '';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    // Navegador sin Intl: se usa el idioma.
  }
  return resolveCurrency({
    stored: read(KEYS.currency),
    chosen: read(CURRENCY_CHOSEN_KEY) === '1',
    timeZone,
    languages: navigator.languages?.length ? navigator.languages : [navigator.language ?? ''],
  });
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

  /** Cambio de moneda hecho por la persona: queda fijo, ya no se vuelve a adivinar. */
  chooseCurrency(code: string): void {
    write(CURRENCY_CHOSEN_KEY, '1');
    this.currency.set(code);
  }

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
