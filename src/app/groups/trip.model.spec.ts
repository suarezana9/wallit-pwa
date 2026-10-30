import type { Movimiento } from '../core/database.types';
import { formatTripRange, tripStatus, tripSummary } from './trip.model';

const gasto = (amount: number, date: string, category = 'Restaurantes', extra: Partial<Movimiento> = {}): Movimiento => ({
  id: date + amount, group_id: 'g', user_id: 'u', amount, category, description: '', date, is_private: false,
  receipt_url: null, created_at: '', tipo: 'gasto', fuente: null, paid_by: null, division: null, detalle: null, medio_pago: null, ...extra,
});

describe('trip.model', () => {
  it('formatea el rango del viaje', () => {
    expect(formatTripRange('2026-11-12', '2026-11-18', 'es-AR')).toBe('12–18 nov');
    expect(formatTripRange('2026-10-28', '2026-11-03', 'es-AR')).toBe('28 oct – 3 nov');
    expect(formatTripRange('2026-11-12', null, 'es-AR')).toBe('desde 12 nov');
    expect(formatTripRange(null, null, 'es-AR')).toBe('');
  });

  it('sabe si el viaje no empezó, está en curso o terminó', () => {
    const trip = { fecha_inicio: '2026-11-12', fecha_fin: '2026-11-18' };
    expect(tripStatus(trip, '2026-11-01')).toBe('upcoming');
    expect(tripStatus(trip, '2026-11-15')).toBe('ongoing');
    expect(tripStatus(trip, '2026-11-19')).toBe('ended');
    expect(tripStatus({ fecha_inicio: null, fecha_fin: null }, '2026-11-19')).toBe('undated');
  });

  it('resume el viaje: total, por persona, por día y categorías', () => {
    const movements = [
      gasto(30000, '2026-11-12', 'Restaurantes'),
      gasto(60000, '2026-11-13', 'Viajes'),
      gasto(5000, '2026-11-13', 'Restaurantes', { is_private: true }),
      gasto(9000, '2026-11-14', 'Bar', { tipo: 'ingreso' }),
    ];
    const summary = tripSummary(movements, 3, { fecha_inicio: '2026-11-12', fecha_fin: '2026-11-17' });
    expect(summary).toEqual({
      total: 90000, perPerson: 30000, days: 6, perDay: 15000,
      topCategories: [{ name: 'Viajes', total: 60000 }, { name: 'Restaurantes', total: 30000 }],
    });
    expect(tripSummary(movements, 3, { fecha_inicio: null, fecha_fin: null }).days).toBe(2);
  });
});
