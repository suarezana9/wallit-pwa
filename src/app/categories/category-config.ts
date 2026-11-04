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
  /** Orden elegido (nombres). Lo que no está acá va después, en el orden de siempre. */
  orden?: string[];
  /** Predeterminadas que la persona eliminó (no aparecen en ningún lado; se pueden recuperar). */
  borradas?: string[];
}

export const EMPTY_CONFIG: CategoryConfig = { ocultas: [], personalizadas: [] };

/** Íconos para categorías propias, agrupados por tema (el picker muestra los títulos de grupo). */
export const EMOJI_GROUPS: readonly { id: string; emojis: readonly string[] }[] = [
  { id: 'home', emojis: ['🏠', '🏡', '🏢', '🔑', '🛋️', '🛏️', '🚿', '🧺', '🧽', '🧹', '🧴', '🪴', '🌿', '🛠️', '🔧', '🪛', '🧰', '🔌', '💡', '🔥', '💧', '📦', '🗑️', '🪟'] },
  { id: 'food', emojis: ['🛒', '🍔', '🍕', '🌮', '🍣', '🍝', '🥗', '🍗', '🥩', '🥦', '🍎', '🥖', '🧀', '🥚', '🥛', '☕', '🧉', '🍺', '🍷', '🍹', '🥤', '🍦', '🧁', '🍫', '🍪'] },
  { id: 'transport', emojis: ['🚗', '🚕', '🚌', '🚇', '🚆', '🚲', '🛵', '🏍️', '⛽', '🅿️', '🛣️', '🚙', '🚚', '✈️', '⛴️', '🛞'] },
  { id: 'health', emojis: ['🩺', '💊', '🦷', '👓', '🧠', '❤️‍🩹', '🏥', '🧘', '🏋️', '🏃', '🚴', '🏊', '⚽', '🎾', '🏀', '💆', '💈', '💅', '🧖'] },
  { id: 'fun', emojis: ['🎬', '🍿', '📺', '🎮', '🎵', '🎸', '🎧', '🎤', '🎨', '📷', '🎭', '🎟️', '🎳', '🎲', '🧩', '📚', '📖', '🎉', '🎂', '🎁', '🎪', '🏖️', '⛺', '🏄'] },
  { id: 'shopping', emojis: ['🛍️', '👕', '👖', '👗', '👟', '👠', '👜', '🎒', '💍', '⌚', '🕶️', '💄', '🧸', '🪑', '🖥️', '💻', '📱', '🎧', '🔋'] },
  { id: 'money', emojis: ['💰', '💵', '💳', '🏦', '🐷', '📈', '📉', '🧾', '📑', '💼', '🪙', '💎', '🤝', '📊', '🧮', '🏛️'] },
  { id: 'family', emojis: ['👶', '🍼', '🧒', '👨‍👩‍👧', '👵', '🎓', '🏫', '✏️', '📝', '🐶', '🐱', '🐾', '🐟', '🐦', '🦴', '❤️', '💐', '🌹'] },
  { id: 'work', emojis: ['💼', '🖨️', '📎', '📮', '📞', '🌐', '☁️', '🔒', '⚙️', '🧑‍💻', '👩‍🍳', '🧑‍🔧', '🚀', '🏷️', '🎯', '⭐', '🌙', '🌈', '🍀', '🦋'] },
];

/** Todos los íconos en una sola lista, sin repetidos (el primero de la lista es el de por defecto). */
export const EMOJI_CHOICES: readonly string[] = [...new Set(['🏷️', ...EMOJI_GROUPS.flatMap((g) => g.emojis)])];

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
    ...(Array.isArray(value.orden) ? { orden: value.orden.filter((v) => typeof v === 'string') } : {}),
    ...(Array.isArray(value.borradas) ? { borradas: value.borradas.filter((v) => typeof v === 'string') } : {}),
  };
}

export function customToInfo(custom: CustomCategory): CategoryInfo {
  return { name: custom.nombre, emoji: custom.emoji, color: custom.color };
}

/** Una fila de la pantalla Categorías: predeterminada o propia, activa o no. */
export interface CategoryEntry extends CategoryInfo {
  /** Solo en las propias. */
  custom?: CustomCategory;
  hidden: boolean;
}

/** Predeterminadas que siguen en uso (no eliminadas). */
export function activeBuiltins(config: CategoryConfig): CategoryInfo[] {
  const deleted = new Set(config.borradas ?? []);
  return CATEGORIES.filter((c) => !deleted.has(c.name));
}

/** Todas las categorías en una sola lista, en el orden elegido: predeterminadas y propias, activas o desactivadas. */
export function allCategories(config: CategoryConfig): CategoryEntry[] {
  const hidden = new Set(config.ocultas);
  const builtins = activeBuiltins(config);
  // Si alguien ya se había creado una propia con el nombre de una predeterminada, no se duplica.
  const builtinNames = new Set(builtins.map((c) => c.name));
  return applyOrder<CategoryEntry>(
    [
      ...builtins.map((c) => ({ ...c, hidden: hidden.has(c.name) })),
      ...config.personalizadas
        .filter((c) => !builtinNames.has(c.nombre))
        .map((c) => ({ ...customToInfo(c), custom: c, hidden: hidden.has(c.nombre) })),
    ],
    config.orden ?? [],
  );
}

/** Categorías disponibles para cargar: las activas, en el orden elegido. */
export function visibleCategories(config: CategoryConfig): CategoryInfo[] {
  return allCategories(config)
    .filter((c) => !c.hidden)
    .map(({ name, emoji, color }) => ({ name, emoji, color }));
}

/** Primero las que tienen lugar en `order` (en ese orden) y después el resto, como venían. */
export function applyOrder<T extends { name: string }>(list: readonly T[], order: readonly string[]): T[] {
  if (!order.length) return [...list];
  const position = new Map(order.map((name, i) => [name, i]));
  return list
    .map((item, i) => ({ item, key: position.get(item.name) ?? order.length + i }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

/** Mueve un elemento de `from` a `to` (lo que devuelve ion-reorder-group). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function lookupCategory(name: string, config: CategoryConfig): CategoryInfo {
  const builtin = activeBuiltins(config).find((c) => c.name === name);
  if (builtin) return builtin;
  const custom = config.personalizadas.find((c) => c.nombre === name);
  if (custom) return customToInfo(custom);
  // Una predeterminada eliminada conserva su ícono en los movimientos viejos.
  return CATEGORIES.find((c) => c.name === name) ?? { name, emoji: '📦', color: '#9CA3AF' };
}

export function nameTaken(name: string, config: CategoryConfig): boolean {
  const key = name.trim().toLowerCase();
  return (
    activeBuiltins(config).some((c) => c.name.toLowerCase() === key) ||
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
  [['cine', 'pelicula'], '🎬'],
  [['farmacia', 'remedio', 'medicamento'], '💊'],
  [['optica', 'anteojo', 'lente'], '👓'],
  [['mate', 'yerba'], '🧉'],
  [['vinoteca'], '🍷'],
  [['heladeria', 'helado'], '🍦'],
  [['sushi'], '🍣'],
  [['moto'], '🏍️'],
  [['bici', 'bicicleta'], '🚲'],
  [['auto', 'seguro auto', 'mecanico', 'taller'], '🚗'],
  [['avion', 'pasaje'], '✈️'],
  [['mascota', 'alimento perro', 'alimento gato'], '🐾'],
  [['muebles', 'deco', 'decoracion'], '🛋️'],
  [['tecnologia', 'computadora', 'notebook'], '💻'],
  [['joya', 'joyeria'], '💍'],
  [['maquillaje', 'perfume', 'cosmetica'], '💄'],
  [['juguete', 'jugueteria'], '🧸'],
  [['sueldo', 'salario'], '💵'],
  [['banco', 'comision'], '🏦'],
  [['trabajo', 'oficina', 'coworking'], '💼'],
  [['software', 'suscripcion', 'nube', 'icloud', 'google one'], '☁️'],
  [['correo', 'envio', 'mercado libre'], '📦'],
  [['fiesta', 'evento'], '🎉'],
  [['camping'], '⛺'],
  [['natacion', 'pileta'], '🏊'],
  [['spa', 'masaje'], '💆'],
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

/**
 * Versión apagada de un color para el modo oscuro: baja la saturación y lleva la luz a un rango medio,
 * así las barras y los íconos de categoría no "brillan" sobre el gris. Deja el tono igual (verde sigue verde).
 */
export function muteForDark(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + 360) % 360;

  const s2 = Math.min(s * 0.6, 0.5);
  const l2 = Math.min(Math.max(l, 0.58), 0.68);
  const c = (1 - Math.abs(2 * l2 - 1)) * s2;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l2 - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
