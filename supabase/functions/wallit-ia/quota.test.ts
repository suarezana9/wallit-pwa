import { deepStrictEqual as assertEquals } from 'node:assert';
import { isMissingFunction, quotaVerdict } from './quota.ts';

Deno.test('consulta permitida: devuelve el id para poder devolverla', () => {
  assertEquals(quotaVerdict({ ok: true, id: 42, usados: 3, limite: 60 }), { error: null, id: 42 });
});

Deno.test('límite por minuto y por día', () => {
  assertEquals(quotaVerdict({ ok: false, motivo: 'minuto' }).error, 'RATE_LIMIT_MINUTE');
  assertEquals(quotaVerdict({ ok: false, motivo: 'dia', usados: 59, limite: 60 }).error, 'DAILY_LIMIT');
  assertEquals(quotaVerdict(null).error, 'DAILY_LIMIT');
});

Deno.test('función inexistente (falta la migración)', () => {
  assertEquals(isMissingFunction({ code: 'PGRST202' }), true);
  assertEquals(isMissingFunction({ code: '42501' }), false);
  assertEquals(isMissingFunction(null), false);
});
