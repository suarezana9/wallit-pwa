/**
 * Datos para cobrar: un alias (o cualquier identificador: PayPal, Revolut…) y una cuenta
 * (CBU/CVU de Argentina o IBAN). Validación y textos para compartir; sin dependencias de Angular.
 */

export interface PayoutInfo {
  alias: string | null;
  cuenta: string | null;
}

export type CuentaError = 'cbuDigits' | 'cbuCheck' | 'format';

/** Quita espacios, guiones y puntos ("0000003100 0123-4567 8901" → "0000003100012345678901"). */
export function normalizeCuenta(raw: string): string {
  return raw.replace(/[\s.-]/g, '').toUpperCase();
}

/** Dígito verificador de CBU/CVU (Banco Central): dos bloques de 8 y 14 dígitos. */
function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
  return (10 - (sum % 10)) % 10;
}

export function isValidCbu(cbu: string): boolean {
  if (!/^\d{22}$/.test(cbu)) return false;
  const block1 = cbu.slice(0, 8);
  const block2 = cbu.slice(8);
  return (
    checkDigit(block1, [7, 1, 3, 9, 7, 1, 3]) === Number(block1[7]) &&
    checkDigit(block2, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]) === Number(block2[13])
  );
}

/** IBAN: país (2 letras), control (2 dígitos) y la cuenta; con el control mod 97 de ISO 13616. */
export function isValidIban(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  const numeric = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) remainder = (remainder * 10 + Number(ch)) % 97;
  return remainder === 1;
}

/** null = válida (o vacía). */
export function cuentaError(raw: string): CuentaError | null {
  const value = normalizeCuenta(raw);
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    if (value.length !== 22) return 'cbuDigits';
    return isValidCbu(value) ? null : 'cbuCheck';
  }
  return isValidIban(value) ? null : 'format';
}

export function aliasError(raw: string): boolean {
  const value = raw.trim();
  return value.length > 0 && (value.length < 3 || value.length > 60);
}

/** Para mostrar: el CBU de a bloques de 4 ("0000 0031 0001 ..."), más fácil de leer y dictar. */
export function formatCuenta(cuenta: string): string {
  return cuenta.replace(/(.{4})/g, '$1 ').trim();
}

export function hasPayout(info: PayoutInfo | null | undefined): boolean {
  return !!(info?.alias || info?.cuenta);
}

/** Mensaje para recordarle a alguien que te debe (por WhatsApp o lo que elija el navegador). */
export function reminderText(opts: {
  debtor: string;
  group: string;
  amount: string;
  mine: PayoutInfo | null;
  labels: { greeting: (name: string, group: string, amount: string) => string; alias: string; cuenta: string };
}): string {
  const lines = [opts.labels.greeting(opts.debtor, opts.group, opts.amount)];
  if (opts.mine?.alias) lines.push(`${opts.labels.alias}: ${opts.mine.alias}`);
  if (opts.mine?.cuenta) lines.push(`${opts.labels.cuenta}: ${opts.mine.cuenta}`);
  return lines.join('\n');
}
