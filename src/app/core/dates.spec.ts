import { isInRange, monthRange, relativeDate, toIsoDate } from './dates';

describe('dates', () => {
  const today = new Date(2026, 9, 21);

  it('arma el rango del mes en hora local', () => {
    expect(monthRange(0, today)).toMatchObject({ from: '2026-10-01', to: '2026-10-31', isCurrent: true });
    expect(monthRange(-10, today)).toMatchObject({ from: '2025-12-01', to: '2025-12-31', isCurrent: false });
  });

  it('formatea el label del mes', () => {
    expect(monthRange(0, today).label).toBe('Octubre 2026');
  });

  it('compara fechas ISO por rango', () => {
    const range = monthRange(0, today);
    expect(isInRange('2026-10-15', range)).toBe(true);
    expect(isInRange('2026-11-01', range)).toBe(false);
  });

  it('muestra hoy y ayer', () => {
    expect(relativeDate(toIsoDate(today), today)).toBe('Hoy');
    expect(relativeDate('2026-10-20', today)).toBe('Ayer');
  });
});
