import { spaceColor } from './space-color';

describe('spaceColor', () => {
  it('es estable y devuelve un color de la paleta', () => {
    expect(spaceColor('abc')).toBe(spaceColor('abc'));
    expect(spaceColor('abc')).toMatch(/^#[0-9a-f]{6}$/);
    const colors = new Set(['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map(spaceColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});
