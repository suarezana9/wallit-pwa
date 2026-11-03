import { weeksOf } from './insights-store';

describe('weeksOf', () => {
  const list = [
    { tipo: 'gasto', amount: 100, date: '2026-11-02' },
    { tipo: 'gasto', amount: 50, date: '2026-11-07' },
    { tipo: 'ingreso', amount: 9999, date: '2026-11-03' },
    { tipo: 'gasto', amount: 30, date: '2026-11-30' },
    { tipo: 'gasto', amount: 70, date: '2026-10-02' },
  ];

  it('agrupa los gastos del mes en tramos de 7 días y marca la semana de hoy', () => {
    const weeks = weeksOf('2026-11-01', list, new Date(2026, 10, 9));
    expect(weeks.map((w) => w.label)).toEqual(['1–7', '8–14', '15–21', '22–28', '29–30']);
    expect(weeks.map((w) => w.gastos)).toEqual([150, 0, 0, 0, 30]);
    expect(weeks.map((w) => w.isCurrent)).toEqual([false, true, false, false, false]);
  });

  it('en un mes pasado no marca ninguna semana', () => {
    expect(weeksOf('2026-10-01', list, new Date(2026, 10, 9)).some((w) => w.isCurrent)).toBe(false);
  });
});
