import {
  EMPTY_CONFIG, colorFor, filterCategories, findExact, lookupCategory, nameTaken, parseConfig, suggestEmoji, visibleCategories, muteForDark, EMOJI_CHOICES, EMOJI_GROUPS, applyOrder, moveItem, allCategories,
} from './category-config';

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

describe('crear categoría desde el formulario', () => {
  it('busca sin tildes ni mayúsculas y encuentra coincidencias exactas', () => {
    const list = [{ name: 'Educación' }, { name: 'Ocio' }, { name: 'Bebé' }];
    expect(filterCategories(list, 'educa').map((c) => c.name)).toEqual(['Educación']);
    expect(findExact(list, ' bebe ')?.name).toBe('Bebé');
    expect(findExact(list, 'Beb')).toBeUndefined();
  });

  it('sugiere emoji y color estables', () => {
    expect(suggestEmoji('Gimnasio')).toBe('🏋️');
    expect(suggestEmoji('Pañales del bebé')).toBe('👶');
    expect(suggestEmoji('Cosas raras')).toBe('🏷️');
    expect(colorFor('Gimnasio')).toBe(colorFor('gimnasio'));
  });

  it('apaga los colores para el modo oscuro sin cambiar el tono', () => {
    const lime = muteForDark('#84CC16');
    expect(lime).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(lime.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(110);
    expect(muteForDark('#9CA3AF')).toMatch(/^#[0-9a-f]{6}$/);
    expect(muteForDark('rojo')).toBe('rojo');
  });

  it('ofrece muchos íconos, agrupados y sin repetidos dentro de cada grupo', () => {
    expect(EMOJI_CHOICES.length).toBeGreaterThan(150);
    expect(new Set(EMOJI_CHOICES).size).toBe(EMOJI_CHOICES.length);
    for (const group of EMOJI_GROUPS) expect(new Set(group.emojis).size).toBe(group.emojis.length);
    expect(suggestEmoji('Farmacia')).toBe('💊');
    expect(suggestEmoji('Cine con amigos')).toBe('🎬');
  });

  it('aplica el orden elegido y deja el resto como venía', () => {
    const list = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
    expect(applyOrder(list, ['C', 'A']).map((c) => c.name)).toEqual(['C', 'A', 'B', 'D']);
    expect(applyOrder(list, []).map((c) => c.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(moveItem(['A', 'B', 'C', 'D'], 3, 0)).toEqual(['D', 'A', 'B', 'C']);
    expect(moveItem(['A', 'B', 'C', 'D'], 0, 2)).toEqual(['B', 'C', 'A', 'D']);
    const config = parseConfig({ ocultas: [], personalizadas: [], orden: ['Salud'] });
    expect(visibleCategories(config)[0].name).toBe('Salud');
  });

  it('junta predeterminadas (también las desactivadas) y propias en una sola lista ordenada', () => {
    const config = parseConfig({
      ocultas: ['Bar'],
      personalizadas: [{ id: 'c1', nombre: 'Yerba', emoji: '🧉', color: '#16A34A' }],
      orden: ['Yerba', 'Bar'],
    });
    const all = allCategories(config);
    expect(all.slice(0, 2).map((c) => [c.name, c.hidden, !!c.custom])).toEqual([['Yerba', false, true], ['Bar', true, false]]);
    // Para cargar: sin las desactivadas, mismo orden.
    expect(visibleCategories(config).map((c) => c.name).slice(0, 2)).toEqual(['Yerba', 'Supermercado']);
  });

  it('permite desactivar propias y eliminar predeterminadas', () => {
    const config = parseConfig({
      ocultas: ['Yerba'],
      personalizadas: [{ id: 'c1', nombre: 'Yerba', emoji: '🧉', color: '#16A34A' }],
      borradas: ['Supermercado'],
    });
    const names = allCategories(config).map((c) => c.name);
    expect(names).not.toContain('Supermercado');
    expect(allCategories(config).find((c) => c.name === 'Yerba')?.hidden).toBe(true);
    expect(visibleCategories(config).map((c) => c.name)).not.toContain('Yerba');
    // Los movimientos viejos siguen mostrando el ícono de la eliminada, y el nombre queda libre.
    expect(lookupCategory('Supermercado', config).emoji).toBe('🛒');
    expect(nameTaken('supermercado', config)).toBe(false);
  });
});
