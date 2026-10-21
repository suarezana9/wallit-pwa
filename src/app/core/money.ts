import { Pipe, PipeTransform, inject } from '@angular/core';
import { currencyInfo } from './currencies';
import { PreferencesStore } from './preferences-store';

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(key: string, locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    formatters.set(key, f);
  }
  return f;
}

export function formatMoney(amount: number, currency = 'ARS'): string {
  const { locale } = currencyInfo(currency);
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return formatter(`${currency}|${decimals}`, locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatMoneyCompact(amount: number, currency = 'ARS'): string {
  const { locale } = currencyInfo(currency);
  return formatter(`${currency}|compact`, locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly preferences = inject(PreferencesStore);

  transform(amount: number | null | undefined): string {
    return amount === null || amount === undefined ? '' : formatMoney(amount, this.preferences.currency());
  }
}
