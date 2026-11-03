import { cumulativeByDay, paceOf } from './pace.model';

const g = (date: string, amount: number, tipo = 'gasto') => ({ date, amount, tipo });

describe('pace.model', () => {
  it('acumula solo gastos del mes, día a día', () => {
    const rows = [g('2026-11-01', 100), g('2026-11-03', 50), g('2026-11-03', 9999, 'ingreso'), g('2026-10-31', 70)];
    expect(cumulativeByDay(rows, '2026-11', 4)).toEqual([100, 100, 150, 150]);
  });

  it('mes actual: lo que queda por día y la comparación con el mes anterior a la misma altura', () => {
    const pace = paceOf({
      month: '2026-11',
      previousMonth: '2026-10',
      current: [g('2026-11-01', 2000), g('2026-11-03', 1000)],
      previous: [g('2026-10-02', 3500), g('2026-10-20', 1000)],
      ingresos: 10000,
      disponible: 7000,
      now: new Date(2026, 10, 3),
    });
    expect(pace.today).toBe(3);
    expect(pace.cumulative).toEqual([2000, 2000, 3000]);
    expect(pace.daysLeft).toBe(28);
    expect(pace.perDay).toBe(250);
    expect(pace.vsPrevious).toBe(-500);
    expect(pace.previous?.length).toBe(31);
  });

  it('sin ingresos no calcula por día; sin gastos el mes anterior no compara', () => {
    const pace = paceOf({
      month: '2026-11', previousMonth: '2026-10', current: [g('2026-11-02', 10)], previous: [],
      ingresos: 0, disponible: -10, now: new Date(2026, 10, 3),
    });
    expect(pace.perDay).toBeNull();
    expect(pace.previous).toBeNull();
    expect(pace.vsPrevious).toBeNull();
  });

  it('mes pasado: el mes completo y sin "hoy"', () => {
    const pace = paceOf({
      month: '2026-09', previousMonth: '2026-08', current: [g('2026-09-30', 10)], previous: [],
      ingresos: 0, disponible: 0, now: new Date(2026, 10, 3),
    });
    expect(pace.today).toBeNull();
    expect(pace.cumulative.length).toBe(30);
    expect(pace.spent).toBe(10);
    expect(pace.daysLeft).toBeNull();
  });
});
