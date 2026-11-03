import { trimLeadingMonths } from './insights-store';

describe('trimLeadingMonths', () => {
  const p = (key: string, gastos: number, isCurrent = false) => ({ key, label: key, gastos, ingresos: 0, isCurrent });

  it('saca los meses vacíos o casi vacíos del principio', () => {
    const points = [p('jun', 1000), p('jul', 0), p('ago', 0), p('sep', 0), p('oct', 0), p('nov', 3_800_000, true)];
    expect(trimLeadingMonths(points).map((x) => x.key)).toEqual(['nov']);
  });

  it('deja los meses del medio aunque tengan poco, una vez que arrancó la actividad', () => {
    const points = [p('ago', 0), p('sep', 900_000), p('oct', 10_000), p('nov', 1_000_000, true)];
    expect(trimLeadingMonths(points).map((x) => x.key)).toEqual(['sep', 'oct', 'nov']);
  });
});
