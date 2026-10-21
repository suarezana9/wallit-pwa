export interface CurrencyInfo {
  code: string;
  name: { es: string; en: string };
  symbol: string;
  locale: string;
}

export const CURRENCIES: readonly CurrencyInfo[] = [
  { code: 'ARS', name: { es: 'Peso argentino', en: 'Argentine peso' }, symbol: '$', locale: 'es-AR' },
  { code: 'MXN', name: { es: 'Peso mexicano', en: 'Mexican peso' }, symbol: '$', locale: 'es-MX' },
  { code: 'COP', name: { es: 'Peso colombiano', en: 'Colombian peso' }, symbol: '$', locale: 'es-CO' },
  { code: 'CLP', name: { es: 'Peso chileno', en: 'Chilean peso' }, symbol: '$', locale: 'es-CL' },
  { code: 'PEN', name: { es: 'Sol peruano', en: 'Peruvian sol' }, symbol: 'S/', locale: 'es-PE' },
  { code: 'UYU', name: { es: 'Peso uruguayo', en: 'Uruguayan peso' }, symbol: '$', locale: 'es-UY' },
  { code: 'BOB', name: { es: 'Boliviano', en: 'Bolivian boliviano' }, symbol: 'Bs', locale: 'es-BO' },
  { code: 'PYG', name: { es: 'Guaraní paraguayo', en: 'Paraguayan guaraní' }, symbol: '₲', locale: 'es-PY' },
  { code: 'VES', name: { es: 'Bolívar venezolano', en: 'Venezuelan bolívar' }, symbol: 'Bs.D', locale: 'es-VE' },
  { code: 'BRL', name: { es: 'Real brasileño', en: 'Brazilian real' }, symbol: 'R$', locale: 'pt-BR' },
  { code: 'USD', name: { es: 'Dólar estadounidense', en: 'US dollar' }, symbol: '$', locale: 'en-US' },
  { code: 'CAD', name: { es: 'Dólar canadiense', en: 'Canadian dollar' }, symbol: '$', locale: 'en-CA' },
  { code: 'EUR', name: { es: 'Euro', en: 'Euro' }, symbol: '€', locale: 'es-ES' },
  { code: 'GBP', name: { es: 'Libra esterlina', en: 'British pound' }, symbol: '£', locale: 'en-GB' },
  { code: 'CHF', name: { es: 'Franco suizo', en: 'Swiss franc' }, symbol: 'Fr', locale: 'de-CH' },
  { code: 'AUD', name: { es: 'Dólar australiano', en: 'Australian dollar' }, symbol: '$', locale: 'en-AU' },
  { code: 'JPY', name: { es: 'Yen japonés', en: 'Japanese yen' }, symbol: '¥', locale: 'ja-JP' },
  { code: 'CNY', name: { es: 'Yuan chino', en: 'Chinese yuan' }, symbol: '¥', locale: 'zh-CN' },
  { code: 'INR', name: { es: 'Rupia india', en: 'Indian rupee' }, symbol: '₹', locale: 'hi-IN' },
  { code: 'KRW', name: { es: 'Won surcoreano', en: 'South Korean won' }, symbol: '₩', locale: 'ko-KR' },
];

export const DEFAULT_CURRENCY = 'ARS';

const REGION_TO_CURRENCY: Record<string, string> = {
  AR: 'ARS', MX: 'MXN', CO: 'COP', CL: 'CLP', PE: 'PEN', UY: 'UYU', BO: 'BOB', PY: 'PYG',
  VE: 'VES', BR: 'BRL', US: 'USD', CA: 'CAD', ES: 'EUR', FR: 'EUR', DE: 'EUR', IT: 'EUR',
  PT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', GB: 'GBP', CH: 'CHF', AU: 'AUD',
  JP: 'JPY', CN: 'CNY', TW: 'CNY', IN: 'INR', KR: 'KRW',
};

export function currencyInfo(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function currencyForLocale(languageTag: string): string {
  const region = languageTag.split('-')[1]?.toUpperCase() ?? '';
  return REGION_TO_CURRENCY[region] ?? DEFAULT_CURRENCY;
}
