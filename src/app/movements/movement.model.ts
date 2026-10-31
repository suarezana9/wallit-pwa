import type { Division, FuenteIngreso, Json, MedioPago, Movimiento, TipoMovimiento } from '../core/database.types';
import type { TranslationKey } from '../core/i18n/i18n';

export interface TypeInfo {
  id: TipoMovimiento;
  labelKey: TranslationKey;
  pluralKey: TranslationKey;
  placeholderKey: TranslationKey;
  icon: string;
  color: string;
}

export const MOVEMENT_TYPES: readonly TypeInfo[] = [
  { id: 'gasto', labelKey: 'typeGasto', pluralKey: 'expenses', placeholderKey: 'placeholderGasto', icon: 'card-outline', color: 'var(--wl-type-gasto)' },
  { id: 'ingreso', labelKey: 'typeIngreso', pluralKey: 'income', placeholderKey: 'placeholderIngreso', icon: 'arrow-down-outline', color: 'var(--wl-type-ingreso)' },
  { id: 'ahorro', labelKey: 'typeAhorro', pluralKey: 'savings', placeholderKey: 'placeholderAhorro', icon: 'wallet-outline', color: 'var(--wl-type-ahorro)' },
  { id: 'inversion', labelKey: 'typeInversion', pluralKey: 'investments', placeholderKey: 'placeholderInversion', icon: 'trending-up-outline', color: 'var(--wl-type-inversion)' },
];

/**
 * Pago del resumen de la tarjeta cuando las compras ya están cargadas. No se elige en el selector de tipo:
 * sale de cargar un gasto en "Tarjeta de crédito" y responder que las compras ya estaban.
 */
export const CARD_PAYMENT_TYPE: TypeInfo = {
  id: 'pago_tarjeta', labelKey: 'typePagoTarjeta', pluralKey: 'cardPayments', placeholderKey: 'placeholderGasto',
  icon: 'card-outline', color: 'var(--wl-muted)',
};

export const CARD_CATEGORY = 'Tarjeta de crédito';

export function typeInfo(id: TipoMovimiento): TypeInfo {
  if (id === 'pago_tarjeta') return CARD_PAYMENT_TYPE;
  return MOVEMENT_TYPES.find((t) => t.id === id) ?? MOVEMENT_TYPES[0];
}

export const PAYMENT_METHODS: readonly { id: MedioPago; labelKey: TranslationKey; emoji: string }[] = [
  { id: 'efectivo', labelKey: 'payCash', emoji: '💵' },
  { id: 'debito', labelKey: 'payDebit', emoji: '🏧' },
  { id: 'credito', labelKey: 'payCredit', emoji: '💳' },
  { id: 'transferencia', labelKey: 'payTransfer', emoji: '📲' },
];

export function paymentMethodKey(id: string | null | undefined): TranslationKey | null {
  return PAYMENT_METHODS.find((p) => p.id === id)?.labelKey ?? null;
}

export interface CategoryInfo {
  name: string;
  emoji: string;
  color: string;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { name: 'Supermercado', emoji: '🛒', color: '#10B981' },
  { name: 'Servicios', emoji: '💡', color: '#3B82F6' },
  { name: 'Transporte', emoji: '🚌', color: '#F59E0B' },
  { name: 'Salud', emoji: '❤️', color: '#EF4444' },
  { name: 'Educación', emoji: '📚', color: '#8B5CF6' },
  { name: 'Ocio', emoji: '🎬', color: '#EC4899' },
  { name: 'Restaurantes', emoji: '🍽️', color: '#F97316' },
  { name: 'Ropa', emoji: '👕', color: '#06B6D4' },
  { name: 'Tecnología', emoji: '💻', color: '#6366F1' },
  { name: 'Hogar', emoji: '🏠', color: '#84CC16' },
  { name: 'Mascotas', emoji: '🐾', color: '#A78BFA' },
  { name: 'Viajes', emoji: '✈️', color: '#0EA5E9' },
  { name: 'Suscripciones', emoji: '📺', color: '#7C3AED' },
  { name: 'Deporte', emoji: '🏋️', color: '#059669' },
  { name: 'Belleza', emoji: '💄', color: '#DB2777' },
  { name: 'Auto', emoji: '🚗', color: '#D97706' },
  { name: 'Farmacia', emoji: '💊', color: '#DC2626' },
  { name: 'Regalos', emoji: '🎁', color: '#9333EA' },
  { name: 'Delivery', emoji: '🛵', color: '#EA580C' },
  { name: 'Bar', emoji: '☕', color: '#92400E' },
  { name: 'Banco', emoji: '🏦', color: '#1D4ED8' },
  { name: 'Tarjeta de crédito', emoji: '💳', color: '#0F766E' },
  { name: 'Trabajo', emoji: '💼', color: '#374151' },
  { name: 'Otros', emoji: '📦', color: '#9CA3AF' },
];

const FALLBACK_CATEGORY: CategoryInfo = { name: 'Otros', emoji: '📦', color: '#9CA3AF' };

export function categoryInfo(name: string): CategoryInfo {
  return CATEGORIES.find((c) => c.name === name) ?? { ...FALLBACK_CATEGORY, name };
}

export const INCOME_SOURCES: readonly { id: FuenteIngreso; labelKey: TranslationKey }[] = [
  { id: 'sueldo', labelKey: 'sourceSueldo' },
  { id: 'freelance', labelKey: 'sourceFreelance' },
  { id: 'alquiler', labelKey: 'sourceAlquiler' },
  { id: 'otro', labelKey: 'sourceOtro' },
];

export function incomeSourceKey(id: string | null): TranslationKey | null {
  return INCOME_SOURCES.find((s) => s.id === id)?.labelKey ?? null;
}

export interface MovementInput {
  tipo: TipoMovimiento;
  amount: number;
  category: string;
  fuente: FuenteIngreso | null;
  description: string;
  date: string;
  is_private: boolean;
  /** Ruta del comprobante en el bucket. Si no viene, no se toca. */
  receipt_url?: string | null;
  /** Espacio donde se guarda (solo al crear). Si no viene, el espacio activo. null = Personal. */
  group_id?: string | null;
  /** Quién pagó, si no fue quien lo carga. */
  paid_by?: string | null;
  /** Cómo se divide (solo gastos de grupo). */
  division?: Division | null;
  /** Ticket con productos y reintegros (expenses.detalle). */
  detalle?: Json | null;
  /** Cómo se pagó (opcional). */
  medio_pago?: MedioPago | null;
  /** Compra en cuotas (migración 017). */
  compra_id?: string | null;
  cuota_num?: number | null;
  cuotas_total?: number | null;
  /** Fijo que lo generó. */
  recurrente_id?: string | null;
}

export interface MonthSummary {
  ingresos: number;
  gastos: number;
  ahorros: number;
  inversiones: number;
  disponible: number;
  tasaAhorro: number | null;
}

export function summarize(movements: readonly Movimiento[]): MonthSummary {
  const total = (tipo: TipoMovimiento) =>
    movements.filter((m) => m.tipo === tipo).reduce((sum, m) => sum + Number(m.amount), 0);
  const ingresos = total('ingreso');
  const gastos = total('gasto');
  const ahorros = total('ahorro');
  const inversiones = total('inversion');
  return {
    ingresos,
    gastos,
    ahorros,
    inversiones,
    disponible: ingresos - gastos - ahorros - inversiones,
    tasaAhorro: ingresos > 0 ? ((ahorros + inversiones) / ingresos) * 100 : null,
  };
}

export function sortMovements(list: readonly Movimiento[]): Movimiento[] {
  return [...list].sort((a, b) =>
    a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date),
  );
}
