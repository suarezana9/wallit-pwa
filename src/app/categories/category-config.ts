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
  return [...CATEGORIES.filter((c) => !hidden.has(c.name)), ...config.personalizadas.map(customToInfo)];
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
