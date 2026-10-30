import { EMPTY_CONFIG, lookupCategory, nameTaken, parseConfig, visibleCategories } from './category-config';

const config = {
  ocultas: ['Tecnología', 'Bar'],
  personalizadas: [{ id: 'c1', nombre: 'Bebé', emoji: '👶', color: '#EC4899' }],
};

describe('category-config', () => {
  it('lee la config de la base aunque venga vacía o rota', () => {
    expect(parseConfig(null)).toEqual(EMPTY_CONFIG);
    expect(parseConfig({ ocultas: 'x' })).toEqual(EMPTY_CONFIG);
    expect(parseConfig(config)).toEqual(config);
  });

  it('muestra las predeterminadas no ocultas y las propias al final', () => {
    const names = visibleCategories(config).map((c) => c.name);
    expect(names).not.toContain('Tecnología');
    expect(names.at(-1)).toBe('Bebé');
  });

  it('busca emoji y color de propias y desconocidas', () => {
    expect(lookupCategory('Bebé', config)).toMatchObject({ emoji: '👶', color: '#EC4899' });
    expect(lookupCategory('Supermercado', config).emoji).toBe('🛒');
    expect(lookupCategory('De otro miembro', config)).toMatchObject({ name: 'De otro miembro', emoji: '📦' });
  });

  it('no permite nombres repetidos sin importar mayúsculas', () => {
    expect(nameTaken('supermercado', config)).toBe(true);
    expect(nameTaken(' bebé ', config)).toBe(true);
    expect(nameTaken('Gimnasio', config)).toBe(false);
  });
});
