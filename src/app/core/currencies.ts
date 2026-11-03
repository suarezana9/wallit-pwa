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

/**
 * Zona horaria del dispositivo → moneda. Es mejor pista que el idioma: un iPhone en "Español (España)"
 * usado en Buenos Aires tiene idioma es-ES pero zona America/Argentina/Buenos_Aires.
 * Se busca por prefijo (America/Argentina/Cordoba también es ARS).
 */
const TIMEZONE_TO_CURRENCY: readonly [string, string][] = [
  ['America/Argentina', 'ARS'], ['America/Buenos_Aires', 'ARS'], ['America/Cordoba', 'ARS'], ['America/Mendoza', 'ARS'],
  ['America/Mexico_City', 'MXN'], ['America/Cancun', 'MXN'], ['America/Monterrey', 'MXN'], ['America/Merida', 'MXN'],
  ['America/Tijuana', 'MXN'], ['America/Chihuahua', 'MXN'], ['America/Hermosillo', 'MXN'], ['America/Mazatlan', 'MXN'],
  ['America/Bogota', 'COP'], ['America/Santiago', 'CLP'], ['America/Punta_Arenas', 'CLP'], ['America/Lima', 'PEN'],
  ['America/Montevideo', 'UYU'], ['America/La_Paz', 'BOB'], ['America/Asuncion', 'PYG'], ['America/Caracas', 'VES'],
  ['America/Sao_Paulo', 'BRL'], ['America/Fortaleza', 'BRL'], ['America/Recife', 'BRL'], ['America/Bahia', 'BRL'],
  ['America/Belem', 'BRL'], ['America/Manaus', 'BRL'], ['America/Cuiaba', 'BRL'], ['America/Porto_Velho', 'BRL'],
  ['America/Toronto', 'CAD'], ['America/Vancouver', 'CAD'], ['America/Edmonton', 'CAD'], ['America/Winnipeg', 'CAD'],
  ['America/Halifax', 'CAD'], ['America/St_Johns', 'CAD'], ['America/Regina', 'CAD'],
  ['America/New_York', 'USD'], ['America/Chicago', 'USD'], ['America/Denver', 'USD'], ['America/Los_Angeles', 'USD'],
  ['America/Phoenix', 'USD'], ['America/Anchorage', 'USD'], ['America/Detroit', 'USD'], ['America/Indiana', 'USD'],
  ['Pacific/Honolulu', 'USD'],
  ['Europe/Madrid', 'EUR'], ['Atlantic/Canary', 'EUR'], ['Europe/Paris', 'EUR'], ['Europe/Berlin', 'EUR'], ['Europe/Rome', 'EUR'],
  ['Europe/Lisbon', 'EUR'], ['Europe/Amsterdam', 'EUR'], ['Europe/Brussels', 'EUR'], ['Europe/Vienna', 'EUR'], ['Europe/Dublin', 'EUR'],
  ['Europe/London', 'GBP'], ['Europe/Zurich', 'CHF'], ['Australia/', 'AUD'], ['Asia/Tokyo', 'JPY'], ['Asia/Shanghai', 'CNY'],
  ['Asia/Kolkata', 'INR'], ['Asia/Calcutta', 'INR'], ['Asia/Seoul', 'KRW'],
];

export function currencyForTimeZone(timeZone: string): string | null {
  return TIMEZONE_TO_CURRENCY.find(([prefix]) => timeZone.startsWith(prefix))?.[1] ?? null;
}

/** Moneda inicial: primero la zona horaria, después la región de los idiomas del navegador, si no ARS. */
export function guessCurrency(timeZone: string, languages: readonly string[]): string {
  const byZone = currencyForTimeZone(timeZone);
  if (byZone) return byZone;
  for (const tag of languages) {
    const region = tag.split('-')[1]?.toUpperCase() ?? '';
    if (REGION_TO_CURRENCY[region]) return REGION_TO_CURRENCY[region];
  }
  return DEFAULT_CURRENCY;
}

/**
 * La moneda con la que arranca la app.
 * - Si la persona la eligió en Cuenta, esa.
 * - Si había una guardada sin elegir y es justo la que salía del idioma (la regla vieja, que a un iPhone
 *   en "Español (España)" le ponía euros), se vuelve a adivinar con la zona horaria.
 * - Si no hay nada, se adivina.
 */
export function resolveCurrency(input: {
  stored: string | null;
  chosen: boolean;
  timeZone: string;
  languages: readonly string[];
}): string {
  const valid = input.stored && CURRENCIES.some((c) => c.code === input.stored) ? input.stored : null;
  if (valid && input.chosen) return valid;
  const guess = guessCurrency(input.timeZone, input.languages);
  if (!valid) return guess;
  const oldGuess = currencyForLocale(input.languages[0] ?? '');
  return valid === oldGuess ? guess : valid;
}
