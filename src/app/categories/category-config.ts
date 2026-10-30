import { CATEGORIES, CategoryInfo } from '../movements/movement.model';

export interface CustomCategory {
  id: string;
  nombre: string;
  emoji: string;
  color: string;
}

/** Mismo formato que guarda la app móvil en users.categoria_config. */
export interface CategoryConfig {
  ocultas: string[];
  personalizadas: CustomCategory[];
}

export const EMPTY_CONFIG: CategoryConfig = { ocultas: [], personalizadas: [] };

export const EMOJI_CHOICES = [
  '🏷️', '🎯', '🎮', '🧘', '🍺', '🧁', '🌿', '🏖️', '🎸', '💈',
  '🛠️', '🚀', '🎓', '🌙', '🧠', '🐶', '🐱', '🌺', '⚽', '🎨',
  '📷', '🎪', '🏄', '🎻', '🍀', '🦋', '🔑', '💎', '🌈', '👶',
];

export const COLOR_CHOICES = [
  '#EF4444', '#F97316', '#EAB308', '#84CC16', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#374151', '#92400E',
];

export function parseConfig(raw: unknown): CategoryConfig {
  if (!raw || typeof raw !== 'object') return EMPTY_CONFIG;
  const value = raw as Partial<CategoryConfig>;
  return {
    ocultas: Array.isArray(value.ocultas) ? value.ocultas.filter((v) => typeof v === 'string') : [],
    personalizadas: Array.isArray(value.personalizadas)
      ? value.personalizadas.filter((c) => c && typeof c.nombre === 'string')
      : [],
  };
}

export function customToInfo(custom: CustomCategory): CategoryInfo {
  return { name: custom.nombre, emoji: custom.emoji, color: custom.color };
}

/** Categorías disponibles para cargar: predeterminadas no ocultas + propias. */
export function visibleCategories(config: CategoryConfig): CategoryInfo[] {
  const hidden = new Set(config.ocultas);
  // Si alguien ya se había creado una propia con el nombre de una predeterminada nueva, no se duplica.
  const builtin = new Set(CATEGORIES.map((c) => c.name));
  return [
    ...CATEGORIES.filter((c) => !hidden.has(c.name)),
    ...config.personalizadas.filter((c) => !builtin.has(c.nombre)).map(customToInfo),
  ];
}

export function lookupCategory(name: string, config: CategoryConfig): CategoryInfo {
  const builtin = CATEGORIES.find((c) => c.name === name);
  if (builtin) return builtin;
  const custom = config.personalizadas.find((c) => c.nombre === name);
  return custom ? customToInfo(custom) : { name, emoji: '📦', color: '#9CA3AF' };
}

export function nameTaken(name: string, config: CategoryConfig): boolean {
  const key = name.trim().toLowerCase();
  return (
    CATEGORIES.some((c) => c.name.toLowerCase() === key) ||
    config.personalizadas.some((c) => c.nombre.toLowerCase() === key)
  );
}

/** Minúsculas y sin tildes, para comparar "Educacion" con "Educación". */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Busca por nombre sin importar mayúsculas ni tildes. */
export function filterCategories<T extends { name: string }>(list: readonly T[], query: string, label: (name: string) => string = (n) => n): T[] {
  const q = normalizeName(query);
  if (!q) return [...list];
  return list.filter((c) => normalizeName(c.name).includes(q) || normalizeName(label(c.name)).includes(q));
}

export function findExact<T extends { name: string }>(list: readonly T[], query: string): T | undefined {
  const q = normalizeName(query);
  return q ? list.find((c) => normalizeName(c.name) === q) : undefined;
}

const EMOJI_KEYWORDS: [string[], string][] = [
  [['gym', 'gimnasio', 'crossfit', 'pilates', 'yoga'], '🏋️'],
  [['futbol', 'padel', 'tenis', 'club'], '⚽'],
  [['bebe', 'panal', 'hijo', 'hija', 'nene', 'nena'], '👶'],
  [['perro', 'veterinari'], '🐶'],
  [['gato'], '🐱'],
  [['cafe', 'cafeteria'], '☕'],
  [['cerveza', 'birra', 'vino', 'trago'], '🍺'],
  [['nafta', 'combustible', 'gasolina'], '⛽'],
  [['estacionamiento', 'cochera', 'peaje'], '🅿️'],
  [['alquiler', 'expensas', 'casa', 'depto'], '🏠'],
  [['luz', 'gas', 'agua', 'servicio'], '💡'],
  [['internet', 'celular', 'telefono', 'wifi'], '📱'],
  [['medico', 'dentista', 'prepaga', 'obra social', 'psico', 'terapia', 'clinica'], '🩺'],
  [['colegio', 'escuela', 'curso', 'facultad', 'universidad', 'clase'], '🎓'],
  [['regalo', 'cumple'], '🎁'],
  [['vacaciones', 'hotel', 'vuelo', 'viaje'], '🏖️'],
  [['juego', 'videojuego', 'steam', 'play'], '🎮'],
  [['musica', 'spotify', 'recital'], '🎵'],
  [['libro', 'libreria'], '📚'],
  [['ropa', 'zapatilla', 'calzado'], '👟'],
  [['peluqueria', 'barberia', 'manicura'], '💈'],
  [['impuesto', 'afip', 'arca', 'monotributo', 'abl', 'patente'], '🧾'],
  [['tarjeta', 'credito', 'cuota', 'prestamo'], '💳'],
  [['ahorro'], '🐷'],
  [['inversion', 'acciones', 'cripto', 'plazo fijo'], '📈'],
  [['comida', 'almuerzo', 'cena', 'hamburguesa', 'pizza'], '🍔'],
  [['verduleria', 'fruta', 'verdura'], '🥦'],
  [['carniceria', 'carne', 'asado'], '🥩'],
  [['panaderia', 'pan', 'facturas'], '🥖'],
  [['uber', 'taxi', 'cabify', 'didi'], '🚕'],
  [['colectivo', 'bondi', 'subte', 'tren', 'sube'], '🚌'],
  [['kiosco', 'golosina'], '🍫'],
  [['limpieza', 'lavanderia'], '🧽'],
  [['jardin', 'planta', 'vivero'], '🌿'],
  [['arreglo', 'ferreteria', 'plomero', 'electricista'], '🛠️'],
  [['donacion', 'caridad'], '❤️'],
  [['streaming', 'netflix', 'disney', 'hbo'], '📺'],
];

/** Emoji sugerido a partir del nombre ("Gimnasio" → 🏋️); si no hay pista, una etiqueta. */
export function suggestEmoji(name: string): string {
  const key = normalizeName(name);
  return EMOJI_KEYWORDS.find(([words]) => words.some((w) => key.includes(w)))?.[1] ?? '🏷️';
}

/** Color estable por nombre, así no hace falta elegirlo. */
export function colorFor(name: string): string {
  let hash = 0;
  for (const char of normalizeName(name)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLOR_CHOICES[hash % COLOR_CHOICES.length];
}
