import { deepStrictEqual as assertEquals, ok } from 'node:assert';
const assertStringIncludes = (text: string, part: string) => ok(text.includes(part), part);
import {
  DEFAULT_CATEGORIES, MAX_MOVEMENTS, imagePrompt, sanitizeTicketItems, parseLocaleNumber, readContext, sanitize, sanitizeMany, textPrompt,
} from './parse.ts';

const ctx = readContext({ lang: 'es', currency: 'ARS', today: '2026-10-22', categories: [...DEFAULT_CATEGORIES, 'Bebé'] });

Deno.test('lee el contexto y descarta valores raros', () => {
  const bad = readContext({ lang: 'fr', currency: 'pesos', today: 'ayer', categories: 'x' });
  assertEquals(bad.lang, 'es');
  assertEquals(bad.currency, 'ARS');
  assertEquals(bad.categories, DEFAULT_CATEGORIES);
  assertEquals(/^\d{4}-\d{2}-\d{2}$/.test(bad.today), true);
});

Deno.test('el prompt incluye hoy, la moneda y las categorías propias', () => {
  const prompt = textPrompt('pañales 30 lucas', ctx);
  assertStringIncludes(prompt, '2026-10-22');
  assertStringIncludes(prompt, 'ARS');
  assertStringIncludes(prompt, 'Bebé');
  assertStringIncludes(imagePrompt(ctx), 'TOTAL');
});

Deno.test('valida la respuesta del modelo', () => {
  const raw = '<think>pensando</think> ```json {"tipo":"gasto","monto":"30.000,5","descripcion":"Pañales","categoria":"Bebé","fuente":"sueldo","fecha":"2026-10-21"} ```';
  const m = sanitize(raw, ctx, 'x');
  assertEquals(m.tipo, 'gasto');
  assertEquals(m.categoria, 'Bebé');
  assertEquals(m.fuente, null);
  assertEquals(m.fecha, '2026-10-21');
});

Deno.test('corrige categoría inventada, fecha inválida y monto negativo', () => {
  const m = sanitize('{"tipo":"cualquiera","monto":-50,"categoria":"Inventada","fecha":"21/10"}', ctx, 'texto original');
  assertEquals(m, { tipo: 'gasto', monto: 50, descripcion: 'texto original', categoria: 'Otros', fuente: null, fecha: '2026-10-22' });
});

Deno.test('ingreso con fuente y sin monto', () => {
  const m = sanitize('{"tipo":"ingreso","monto":null,"descripcion":"Sueldo","categoria":"Supermercado","fuente":"sueldo"}', ctx, '');
  assertEquals([m.tipo, m.monto, m.categoria, m.fuente], ['ingreso', null, 'Otros', 'sueldo']);
});

Deno.test('interpreta montos con separadores de distintos países', () => {
  assertEquals(parseLocaleNumber('12.345,67'), 12345.67);
  assertEquals(parseLocaleNumber('12,345.67'), 12345.67);
  assertEquals(parseLocaleNumber('$ 30.000'), 30000);
  assertEquals(parseLocaleNumber('30,000'), 30000);
  assertEquals(parseLocaleNumber('3000.2'), 3000.2);
  assertEquals(parseLocaleNumber('3000,20'), 3000.2);
  assertEquals(parseLocaleNumber('1.234.567'), 1234567);
});

Deno.test('varios movimientos en un mismo pedido', () => {
  const raw = '{"movimientos":[{"tipo":"gasto","monto":20000,"descripcion":"Súper","categoria":"Supermercado"},{"tipo":"gasto","monto":"40.000","descripcion":"Nafta","categoria":"Auto"},"basura"]}';
  const list = sanitizeMany(raw, ctx, 'x');
  assertEquals(list.map((m) => [m.descripcion, m.monto, m.categoria]), [['Súper', 20000, 'Supermercado'], ['Nafta', 40000, 'Auto']]);
});

Deno.test('acepta un objeto suelto y corta en el máximo', () => {
  assertEquals(sanitizeMany('{"tipo":"gasto","monto":10}', ctx, 'x').length, 1);
  const many = JSON.stringify({ movimientos: Array.from({ length: 15 }, (_, i) => ({ tipo: 'gasto', monto: i + 1 })) });
  assertEquals(sanitizeMany(many, ctx, 'x').length, MAX_MOVEMENTS);
});

Deno.test('productos del ticket', () => {
  const raw = '{"tipo":"gasto","monto":"49.352,25","descripcion":"Dia","categoria":"Supermercado","items":[{"descripcion":"Leche condensada","monto":"3.500,00"},{"descripcion":"Choco con leche","monto":1880},{"descripcion":"","monto":5},{"descripcion":"Raro","monto":"x"}]}';
  const m = sanitize(raw, ctx, 'x');
  assertEquals(m.monto, 49352.25);
  assertEquals(m.items, [{ descripcion: 'Leche condensada', monto: 3500 }, { descripcion: 'Choco con leche', monto: 1880 }]);
  assertEquals(sanitizeTicketItems('nada'), []);
  ok(imagePrompt(ctx).includes('"items"'));
});
