import { applyAiMovement, errorKeyFor, normalizeAiResponse } from './ai.model';

const base = { tipo: 'gasto' as const, amount: 500, category: '', fuente: '', description: '', date: '2026-10-22', isPrivate: true };
const categories = ['Supermercado', 'Bebé', 'Otros'];

describe('ai.model', () => {
  it('completa un gasto con categoría propia y conserva otros campos del form', () => {
    const result = applyAiMovement(base, { tipo: 'gasto', monto: 30000, descripcion: 'Pañales', categoria: 'Bebé', fuente: null, fecha: '2026-10-21' }, categories);
    expect(result).toEqual({ ...base, amount: 30000, category: 'Bebé', description: 'Pañales', date: '2026-10-21' });
  });

  it('si no hay monto deja el que estaba y usa Otros si la categoría no existe', () => {
    const result = applyAiMovement(base, { tipo: 'gasto', monto: null, descripcion: '', categoria: 'Inventada', fuente: null, fecha: 'x' }, categories);
    expect(result).toMatchObject({ amount: 500, category: 'Otros', date: '2026-10-22' });
  });

  it('un ingreso lleva fuente y no categoría', () => {
    const result = applyAiMovement(base, { tipo: 'ingreso', monto: 1000, descripcion: 'Sueldo', categoria: 'Otros', fuente: 'sueldo', fecha: '2026-10-01' }, categories);
    expect(result).toMatchObject({ tipo: 'ingreso', category: '', fuente: 'sueldo' });
  });

  it('normaliza la respuesta nueva, la vieja y descarta basura', () => {
    const m = { tipo: 'gasto', monto: 1, descripcion: 'a', categoria: 'Otros', fuente: null, fecha: '2026-10-22' };
    expect(normalizeAiResponse({ movements: [m, m, 'x'], transcript: 'hola' })).toEqual({ movements: [m, m], transcript: 'hola' });
    expect(normalizeAiResponse({ movement: m })?.movements).toEqual([m]);
    expect(normalizeAiResponse({ movements: [] })).toBeNull();
    expect(normalizeAiResponse(null)).toBeNull();
  });

  it('traduce los códigos de error de la función', () => {
    expect(errorKeyFor('UNAUTHORIZED')).toBe('errSessionExpired');
    expect(errorKeyFor('EMPTY_AUDIO')).toBe('errAiAudio');
    expect(errorKeyFor('LO_QUE_SEA')).toBe('errAi');
  });
});

describe('errores de límite de IA', () => {
  it('mapea los códigos del servidor', () => {
    expect(errorKeyFor('RATE_LIMIT_MINUTE')).toBe('errAiRateMinute');
    expect(errorKeyFor('DAILY_LIMIT')).toBe('errAiDailyLimit');
    expect(errorKeyFor('QUOTA_UNAVAILABLE')).toBe('errAi');
  });
});
