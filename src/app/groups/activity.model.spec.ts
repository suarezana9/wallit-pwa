import { groupByLocalDay, relativeTime } from './activity.model';

describe('activity.model', () => {
  const now = new Date('2026-10-29T15:00:00');

  it('muestra tiempos relativos cortos', () => {
    expect(relativeTime('2026-10-29T14:59:30', now, 'es-AR', 'ahora')).toBe('ahora');
    expect(relativeTime('2026-10-29T14:55:00', now, 'es-AR', 'ahora')).toMatch(/5 min/);
    expect(relativeTime('2026-10-29T12:00:00', now, 'es-AR', 'ahora')).toMatch(/3 h/);
    expect(relativeTime('2026-10-24T15:00:00', now, 'es-AR', 'ahora')).toMatch(/5 d/);
  });

  it('agrupa por día respetando el orden', () => {
    const items = [
      { created_at: '2026-10-29T10:00:00' },
      { created_at: '2026-10-29T08:00:00' },
      { created_at: '2026-10-28T20:00:00' },
    ];
    expect(groupByLocalDay(items).map((g) => [g.day, g.items.length])).toEqual([['2026-10-29', 2], ['2026-10-28', 1]]);
  });
});
