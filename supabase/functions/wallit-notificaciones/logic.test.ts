import { deepStrictEqual as assertEquals, ok } from 'node:assert';
import {
  activityDeliveries, budgetMessage, debtDeliveries, netBalances, ngswPayload, reachedThresholds, settleUp, summaryMessage,
  subscriptionsByDevice, totalsByCategory, wants,
} from './logic.ts';

const group = { id: 'g1', name: 'Casa', currency: 'ARS' };
const names = { ana: 'Ana', luigi: 'Luigi', sol: 'Sol' };
const memberIds = ['ana', 'luigi', 'sol'];

Deno.test('las preferencias que faltan valen como activadas', () => {
  assertEquals(wants(null, 'pagos'), true);
  assertEquals(wants({ pagos: false }, 'pagos'), false);
  assertEquals(wants({ gasto_grupo: true, sin_actividad: false }, 'deudas'), true);
});

Deno.test('un gasto nuevo avisa a todos menos a quien lo cargó', () => {
  const [d] = activityDeliveries({
    kind: 'gasto_nuevo', actor: 'luigi', data: { descripcion: 'Nafta', monto: 12000, tipo: 'gasto' }, group, memberIds, names,
  });
  assertEquals(d.userIds, ['ana', 'sol']);
  assertEquals(d.pref, 'gasto_grupo');
  ok(d.message.body.startsWith('Luigi cargó Nafta'), d.message.body);
  ok(d.message.body.includes('12.000'), d.message.body);
  assertEquals(d.message.url, '/grupos/g1');
});

Deno.test('un pago avisa solo a la otra parte', () => {
  const paidByDebtor = activityDeliveries({ kind: 'pago', actor: 'luigi', data: { de: 'luigi', para: 'ana', monto: 5000 }, group, memberIds, names });
  assertEquals(paidByDebtor.map((d) => [d.userIds, d.message.body]), [[['ana'], 'Luigi te pagó $ 5.000']]);
  const registeredByCreditor = activityDeliveries({ kind: 'pago', actor: 'ana', data: { de: 'luigi', para: 'ana', monto: 5000 }, group, memberIds, names });
  assertEquals(registeredByCreditor.map((d) => d.userIds), [['luigi']]);
  ok(registeredByCreditor[0].message.body.includes('registró que le pagaste'));
  assertEquals(activityDeliveries({ kind: 'gasto_editado', actor: 'ana', data: {}, group, memberIds, names }), []);
});

Deno.test('umbrales y mensajes de presupuesto', () => {
  assertEquals(reachedThresholds(70, 100), []);
  assertEquals(reachedThresholds(85, 100), [80]);
  assertEquals(reachedThresholds(120, 100), [80, 100]);
  assertEquals(reachedThresholds(10, 0), []);
  ok(budgetMessage({ id: 'b', name: 'Comida' }, 104.4, 100, null).title.includes('Te pasaste en Comida'));
  assertEquals(budgetMessage({ id: 'b', name: 'Comida' }, 83, 80, 'Casa').title, '⚠️ Comida: 83% usado · Casa');
});

Deno.test('saldos y recordatorio de deudas', () => {
  const all = ['ana', 'luigi', 'sol'];
  const net = netBalances(
    [
      { amount: 30000, user_id: 'ana', paid_by: null, division: { tipo: 'iguales', entre: all }, is_private: false, tipo: 'gasto' },
      { amount: 6000, user_id: 'luigi', paid_by: null, division: { tipo: 'iguales', entre: ['luigi', 'sol'] }, is_private: false, tipo: 'gasto' },
      { amount: 999, user_id: 'sol', paid_by: null, division: { tipo: 'iguales', entre: all }, is_private: true, tipo: 'gasto' },
    ],
    [{ from_user: 'sol', to_user: 'ana', amount: 3000 }],
  );
  assertEquals(Object.fromEntries(net), { ana: 1700000, luigi: -700000, sol: -1000000 });
  const transfers = settleUp(net);
  assertEquals(transfers, [{ from: 'sol', to: 'ana', amount: 10000 }, { from: 'luigi', to: 'ana', amount: 7000 }]);
  const deliveries = debtDeliveries(group, transfers, names);
  assertEquals(deliveries.map((d) => [d.userIds[0], d.message.body]), [
    ['sol', 'Le debés $ 10.000 a Ana.'],
    ['luigi', 'Le debés $ 7.000 a Ana.'],
  ]);
  const multi = debtDeliveries(group, [{ from: 'sol', to: 'ana', amount: 10 }, { from: 'sol', to: 'luigi', amount: 5 }], names);
  assertEquals(multi[0].message.body, 'Debés $ 15 en total (a Ana y Luigi).');
});

Deno.test('payload con el formato de ngsw', () => {
  const payload = JSON.parse(ngswPayload({ title: 't', body: 'b', url: '/grupos/g1', tag: 'x' }));
  assertEquals(payload.notification.data.onActionClick.default, { operation: 'navigateLastFocusedOrOpen', url: '/grupos/g1' });
});

Deno.test('resumen mensual: total, variación y la categoría que más subió', () => {
  const current = totalsByCategory([
    { amount: 100000, category: 'Supermercado', tipo: 'gasto' },
    { amount: 27000, category: 'Delivery', tipo: 'gasto' },
    { amount: 500000, category: 'Tarjeta de crédito', tipo: 'pago_tarjeta' },
    { amount: 900000, category: 'Otros', tipo: 'ingreso' },
  ]);
  assertEquals(current, { Supermercado: 100000, Delivery: 27000 });
  const msg = summaryMessage('2026-10', 'octubre', 'septiembre', { current, previous: { Supermercado: 110000, Delivery: 20000 } });
  assertEquals(msg?.title, '📊 Tu resumen de octubre');
  ok(msg!.body.startsWith('Gastaste $ 127.000 (−2% vs septiembre). Delivery subió 35%.'), msg!.body);
  assertEquals(msg?.url, '/inicio?resumen=2026-10');
  assertEquals(summaryMessage('2026-10', 'octubre', 'septiembre', { current: {}, previous: {} }), null);
  const first = summaryMessage('2026-10', 'octubre', 'septiembre', { current: { Bar: 5000 }, previous: {} });
  ok(first!.body.startsWith('Gastaste $ 5.000. Tocá'), first!.body);
});

Deno.test('un aviso por dispositivo: misma persona y navegador → la suscripción más nueva primero', () => {
  const sub = (id: string, user_id: string, user_agent: string | null, created_at: string) =>
    ({ id, user_id, endpoint: `https://push/${id}`, p256dh: 'k', auth: 'a', user_agent, created_at });
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)';
  const devices = subscriptionsByDevice([
    sub('vieja', 'ana', iphone, '2026-10-01T00:00:00Z'),
    sub('nueva', 'ana', iphone, '2026-11-01T00:00:00Z'),
    sub('compu', 'ana', 'Mozilla/5.0 (Windows NT 10.0)', '2026-09-01T00:00:00Z'),
    sub('sin-ua', 'ana', null, '2026-09-01T00:00:00Z'),
    sub('otra', 'luigi', iphone, '2026-11-01T00:00:00Z'),
  ], 'ana');
  assertEquals(devices.map((d) => d.map((s) => s.id)), [['nueva', 'vieja'], ['compu'], ['sin-ua']]);
});
