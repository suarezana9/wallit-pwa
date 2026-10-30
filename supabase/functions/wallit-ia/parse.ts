// Lógica pura de la función: prompts y validación de lo que devuelve el modelo.
// No depende de Deno ni de Supabase, así se puede testear aparte.

export type Tipo = 'gasto' | 'ingreso' | 'ahorro' | 'inversion';
export type Fuente = 'sueldo' | 'freelance' | 'alquiler' | 'otro';
export type Lang = 'es' | 'en';

export interface ParsedMovement {
  tipo: Tipo;
  monto: number | null;
  descripcion: string;
  categoria: string;
  fuente: Fuente | null;
  fecha: string;
}

export interface PromptContext {
  lang: Lang;
  currency: string;
  today: string;
  categories: string[];
}

const TIPOS: Tipo[] = ['gasto', 'ingreso', 'ahorro', 'inversion'];
const FUENTES: Fuente[] = ['sueldo', 'freelance', 'alquiler', 'otro'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Tope de movimientos por pedido, para que un texto largo no llene la base de basura. */
export const MAX_MOVEMENTS = 10;

export const DEFAULT_CATEGORIES = [
  'Supermercado', 'Servicios', 'Transporte', 'Salud', 'Educación', 'Ocio', 'Restaurantes', 'Ropa', 'Tecnología',
  'Hogar', 'Mascotas', 'Viajes', 'Suscripciones', 'Deporte', 'Belleza', 'Auto', 'Farmacia', 'Regalos', 'Delivery',
  'Bar', 'Banco', 'Trabajo', 'Otros',
];

const JSON_EXAMPLE = (today: string, lang: Lang) =>
  `{"movimientos": [{"tipo": "gasto", "monto": 3000.2, "descripcion": "${lang === 'en' ? 'groceries' : 'pan y leche'}", "categoria": "Supermercado", "fuente": null, "fecha": "${today}"}]}`;

function rules(ctx: PromptContext): string {
  const categories = ctx.categories.join(', ');
  if (ctx.lang === 'en') {
    return `Type rules:
- "ingreso": received money, got paid, salary, income, freelance payment
- "ahorro": saved money, savings deposit, emergency fund
- "inversion": invested, stocks, crypto, fixed term deposit, mutual fund, bonds
- "gasto": bought, paid, spent (default if unclear)

Source (only when type="ingreso"): "sueldo" (salary), "freelance", "alquiler" (rent received) or "otro".

Amount: decimal number in ${ctx.currency}, dot as decimal separator, no currency symbol. If unknown, use null.

Category (only for expenses): use EXACTLY one of these names, they are in Spanish on purpose: ${categories}.
For income, savings and investments use "Otros".
Description: short, max 6 words, in English.
Date: YYYY-MM-DD. Today is ${ctx.today}; resolve "yesterday", "on Monday", etc. relative to it. If no date, use today.

Reply ONLY with a JSON object like: ${JSON_EXAMPLE(ctx.today, 'en')}`;
  }
  return `Reglas para el tipo:
- "ingreso": cobré, me pagaron, recibí plata, sueldo, transferencia recibida, facturé
- "ahorro": ahorré, deposité en caja de ahorro, guardé, fondo de emergencia
- "inversion": invertí, acciones, cripto, plazo fijo, fondo de inversión, CEDEARs, bonos
- "gasto": compré, pagué, gasté, fui a, consumí (si no es claro)

Fuente (solo si tipo="ingreso"): "sueldo", "freelance", "alquiler" u "otro".

Monto: número decimal en ${ctx.currency}, con punto decimal y sin símbolo. "45 lucas" o "45 mil" = 45000; "3000 con 20" = 3000.2. Si no se sabe, null.

Categoría (solo para gastos): usá EXACTAMENTE uno de estos nombres: ${categories}.
Para ingresos, ahorros e inversiones usá "Otros".
Descripción: breve, máximo 6 palabras.
Fecha: YYYY-MM-DD. Hoy es ${ctx.today}; resolvé "ayer", "el lunes", etc. respecto de hoy. Si no hay fecha, usá hoy.

Respondé SOLO con un objeto JSON como: ${JSON_EXAMPLE(ctx.today, 'es')}`;
}

export function textPrompt(text: string, ctx: PromptContext): string {
  const intro =
    ctx.lang === 'en'
      ? `You extract the financial transactions from what the user wrote or said. Usually it is one; if they mention several (e.g. "groceries 20 and gas 40"), return one item per transaction, up to ${MAX_MOVEMENTS}. Never split one purchase into its parts.`
      : `Extraés los movimientos financieros de lo que la persona escribió o dijo. Casi siempre es uno; si menciona varios (ej: "súper 20 mil y nafta 40 mil"), devolvé un ítem por cada uno, hasta ${MAX_MOVEMENTS}. No partas una misma compra en sus partes.`;
  const label = ctx.lang === 'en' ? 'Text' : 'Texto';
  return `${intro}\n\n${rules(ctx)}\n\n${label}: """${text.replace(/"""/g, '"')}"""`;
}

export function imagePrompt(ctx: PromptContext): string {
  const intro =
    ctx.lang === 'en'
      ? 'Analyze this receipt, invoice or payment voucher and extract ONE transaction (a single item in the list). Use the TOTAL amount paid (not subtotals or taxes). Use the store or service name in the description.'
      : 'Analizá este ticket, factura o comprobante y extraé UN movimiento (un solo ítem en la lista). Usá el TOTAL pagado (no subtotales ni impuestos). Poné el nombre del comercio o servicio en la descripción.';
  return `${intro}\n\n${rules(ctx)}`;
}

function extractJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('NO_JSON');
  return JSON.parse(match[0]);
}

/** Interpreta "12.345,67", "12,345.67", "30.000", "3000.2" o "3000,20" como número. */
export function parseLocaleNumber(text: string): number {
  const clean = text.replace(/[^\d.,-]/g, '');
  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    return Number(clean.split(thousands).join('').replace(decimal, '.'));
  }
  const sep = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null;
  if (!sep) return Number(clean);
  const thousandsPattern = sep === '.' ? /^-?\d{1,3}(\.\d{3})+$/ : /^-?\d{1,3}(,\d{3})+$/;
  return thousandsPattern.test(clean) ? Number(clean.split(sep).join('')) : Number(clean.replace(sep, '.'));
}

function toAmount(value: unknown): number | null {
  const n = typeof value === 'string' ? parseLocaleNumber(value) : Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.round(Math.abs(n) * 100) / 100;
}

function sanitizeItem(data: Record<string, unknown>, ctx: PromptContext, fallbackDescription: string): ParsedMovement {
  const tipo = TIPOS.includes(data.tipo as Tipo) ? (data.tipo as Tipo) : 'gasto';
  const categoria =
    tipo === 'gasto' && typeof data.categoria === 'string' && ctx.categories.includes(data.categoria)
      ? data.categoria
      : 'Otros';
  const fecha = typeof data.fecha === 'string' && ISO_DATE.test(data.fecha) ? data.fecha : ctx.today;
  const descripcion =
    typeof data.descripcion === 'string' && data.descripcion.trim()
      ? data.descripcion.trim().slice(0, 120)
      : fallbackDescription.slice(0, 120);
  const fuente = tipo === 'ingreso' && FUENTES.includes(data.fuente as Fuente) ? (data.fuente as Fuente) : null;
  return { tipo, monto: toAmount(data.monto), descripcion, categoria, fuente, fecha };
}

/** Acepta {"movimientos": [...]} o un objeto suelto (por si el modelo se olvida del envoltorio). */
export function sanitizeMany(raw: string, ctx: PromptContext, fallbackDescription: string): ParsedMovement[] {
  const data = extractJson(raw);
  const items = Array.isArray(data.movimientos) ? data.movimientos : [data];
  const movements = items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .slice(0, MAX_MOVEMENTS)
    .map((item) => sanitizeItem(item, ctx, fallbackDescription));
  if (!movements.length) throw new Error('NO_JSON');
  return movements;
}

export function sanitize(raw: string, ctx: PromptContext, fallbackDescription: string): ParsedMovement {
  return sanitizeMany(raw, ctx, fallbackDescription)[0];
}

export function readContext(input: Record<string, unknown>): PromptContext {
  const lang: Lang = input.lang === 'en' ? 'en' : 'es';
  const currency = typeof input.currency === 'string' && /^[A-Z]{3}$/.test(input.currency) ? input.currency : 'ARS';
  const today =
    typeof input.today === 'string' && ISO_DATE.test(input.today) ? input.today : new Date().toISOString().slice(0, 10);
  const categories = Array.isArray(input.categories)
    ? input.categories.filter((c): c is string => typeof c === 'string' && c.length <= 40).slice(0, 60)
    : [];
  return { lang, currency, today, categories: categories.length ? categories : DEFAULT_CATEGORIES };
}
