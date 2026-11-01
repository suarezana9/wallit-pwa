/**
 * Montos escritos a mano. `<input type="number">` no acepta la coma en muchos navegadores (y en Argentina
 * se escribe "1.500,50"), así que los montos usan un campo de texto con teclado decimal y este parser.
 *
 * Reglas:
 *   - Con punto y coma, el último que aparece es el decimal: "1.234,56" y "1,234.56" → 1234.56.
 *   - Solo coma: es el decimal ("12,5" → 12.5). Si hay varias, son miles ("1,234,567" → 1234567).
 *   - Solo punto: si hay varios, o uno solo seguido de exactamente 3 dígitos en español, son miles
 *     ("1.500" → 1500 en es, "12.5" → 12.5). En inglés un punto solo siempre es decimal.
 *   - Máximo 2 decimales. Vacío o inválido → null.
 */
export function parseAmount(raw: string | null | undefined, language: 'es' | 'en' = 'es'): number | null {
  const text = (raw ?? '').replace(/[\s$]/g, '').replace(/[^\d.,-]/g, '');
  if (!text || !/\d/.test(text)) return null;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    normalized = text.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    const parts = text.split(',');
    normalized = parts.length > 2 ? parts.join('') : parts.join('.');
  } else if (lastDot >= 0) {
    const parts = text.split('.');
    const thousands = parts.length > 2 || (language === 'es' && parts[1].length === 3 && parts[0] !== '' && parts[0] !== '0');
    normalized = thousands ? parts.join('') : text;
  } else {
    normalized = text;
  }
  if (!/^-?\d*\.?\d*$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

/** Cómo se muestra un monto en el campo (con separador de miles): 1234.5 → "1.234,5" en es. */
export function formatAmountInput(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return value.toLocaleString(locale, { maximumFractionDigits: 2, useGrouping: true });
}

/** Para copiar y pegar en una transferencia: sin separador de miles y con el decimal del idioma. */
export function amountForClipboard(value: number, language: 'es' | 'en' = 'es'): string {
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return language === 'es' ? fixed.replace('.', ',') : fixed;
}
