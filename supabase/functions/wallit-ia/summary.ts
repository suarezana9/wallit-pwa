// Resumen mensual con IA: la app manda números ya calculados (sin descripciones ni nombres de personas)
// y el modelo devuelve un título, hasta 3 observaciones y un consejo.

export type Lang = 'es' | 'en';

export interface SummaryInput {
  lang: Lang;
  currency: string;
  report: Record<string, unknown>;
}

export interface SummaryOutput {
  titulo: string;
  puntos: string[];
  consejo: string | null;
}

const MAX_REPORT_CHARS = 4000;

/** Valida lo que manda el cliente: un objeto chico con números y textos cortos. */
export function readSummaryInput(body: Record<string, unknown>): SummaryInput | null {
  const report = body.report;
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  const json = JSON.stringify(report);
  if (json.length > MAX_REPORT_CHARS) return null;
  return {
    lang: body.lang === 'en' ? 'en' : 'es',
    currency: typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) ? body.currency : 'ARS',
    report: report as Record<string, unknown>,
  };
}

export function summaryPrompt(input: SummaryInput): string {
  const data = JSON.stringify(input.report);
  if (input.lang === 'en') {
    return `You are a friendly personal finance coach. Below is a month summary (amounts in ${input.currency}), compared with the previous month.
Write in English, second person, warm and concrete. Mention real numbers and categories from the data; never invent data.
- "titulo": one short sentence (max 9 words) with the main takeaway.
- "puntos": 2 or 3 short observations (max 22 words each): what went up, what went down, something positive.
- "consejo": one practical, specific tip for next month (max 25 words), or null if there is nothing useful to say.
Do not judge or scold. Do not recommend financial products.
Reply ONLY with JSON: {"titulo": "...", "puntos": ["..."], "consejo": "..."}

Data: ${data}`;
  }
  return `Sos un coach de finanzas personales, cercano y claro (español rioplatense, tuteo con voseo). Abajo está el resumen de un mes (montos en ${input.currency}) comparado con el anterior.
Usá números y categorías reales de los datos; nunca inventes datos.
- "titulo": una frase corta (máximo 9 palabras) con lo más importante.
- "puntos": 2 o 3 observaciones cortas (máximo 22 palabras cada una): qué subió, qué bajó, algo positivo.
- "consejo": un consejo práctico y concreto para el mes que viene (máximo 25 palabras), o null si no hay nada útil.
No juzgues ni retes. No recomiendes productos financieros.
Respondé SOLO con JSON: {"titulo": "...", "puntos": ["..."], "consejo": "..."}

Datos: ${data}`;
}

const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Normaliza la respuesta del modelo (puede venir con texto alrededor del JSON). */
export function sanitizeSummary(raw: string): SummaryOutput {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('NO_JSON');
  const data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  const titulo = clean(data.titulo, 120);
  const puntos = (Array.isArray(data.puntos) ? data.puntos : []).map((p) => clean(p, 220)).filter(Boolean).slice(0, 3);
  const consejo = clean(data.consejo, 240) || null;
  if (!titulo || !puntos.length) throw new Error('NO_JSON');
  return { titulo, puntos, consejo };
}
