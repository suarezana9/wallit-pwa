import { Pipe, PipeTransform } from '@angular/core';

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, locale: string, decimals: number): Intl.NumberFormat {
  const key = `${locale}|${currency}|${decimals}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(key, f);
  }
  return f;
}

export function formatMoney(amount: number, currency = 'ARS', locale = 'es-AR'): string {
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return formatter(currency, locale, decimals).format(amount);
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: number | null | undefined, currency = 'ARS', locale = 'es-AR'): string {
    return amount === null || amount === undefined ? '' : formatMoney(amount, currency, locale);
  }
}
