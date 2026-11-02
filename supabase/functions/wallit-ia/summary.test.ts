import { deepStrictEqual as assertEquals, ok, throws } from 'node:assert';
import { readSummaryInput, sanitizeSummary, summaryPrompt } from './summary.ts';

Deno.test('valida el pedido de resumen', () => {
  assertEquals(readSummaryInput({ report: 'x' }), null);
  assertEquals(readSummaryInput({ report: { big: 'a'.repeat(5000) } }), null);
  const input = readSummaryInput({ lang: 'en', currency: 'usd', report: { gastos: 10 } });
  assertEquals(input, { lang: 'en', currency: 'ARS', report: { gastos: 10 } });
});

Deno.test('el prompt lleva los datos y pide JSON', () => {
  const prompt = summaryPrompt({ lang: 'es', currency: 'ARS', report: { gastos: 1500 } });
  ok(prompt.includes('"gastos":1500'));
  ok(prompt.includes('SOLO con JSON'));
});

Deno.test('limpia la respuesta del modelo', () => {
  const out = sanitizeSummary('Acá va:\n{"titulo": "  Gastaste 8% menos ", "puntos": ["Delivery subió 35%.", "", "Ahorraste 12%.", "x", "y"], "consejo": ""}');
  assertEquals(out, { titulo: 'Gastaste 8% menos', puntos: ['Delivery subió 35%.', 'Ahorraste 12%.', 'x'], consejo: null });
  throws(() => sanitizeSummary('sin json'));
  throws(() => sanitizeSummary('{"titulo": "", "puntos": []}'));
});
