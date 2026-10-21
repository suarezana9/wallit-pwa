import { Pipe, PipeTransform, Service, computed, inject } from '@angular/core';
import { PreferencesStore } from '../preferences-store';
import { CATEGORY_NAMES_EN, en } from './en';
import { Dictionary, es } from './es';

export type TranslationKey = keyof Dictionary;
type Args<K extends TranslationKey> = Dictionary[K] extends (...args: infer A) => string ? A : [];

const DICTIONARIES = { es, en } as const;

@Service()
export class I18n {
  private readonly preferences = inject(PreferencesStore);
  private readonly dictionary = computed(() => DICTIONARIES[this.preferences.language()]);

  t<K extends TranslationKey>(key: K, ...args: Args<K>): string {
    const entry = this.dictionary()[key] as string | ((...a: string[]) => string);
    return typeof entry === 'function' ? entry(...(args as string[])) : entry;
  }

  category(name: string): string {
    return this.preferences.language() === 'en' ? (CATEGORY_NAMES_EN[name] ?? name) : name;
  }
}

@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform<K extends TranslationKey>(key: K, ...args: Args<K>): string {
    return this.i18n.t(key, ...args);
  }
}
