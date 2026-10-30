import type { FuenteIngreso, TipoMovimiento } from '../core/database.types';

/** Lo que devuelve la Edge Function "wallit-ia". */
export interface AiMovement {
  tipo: TipoMovimiento;
  monto: number | null;
  descripcion: string;
  categoria: string;
  fuente: FuenteIngreso | null;
  fecha: string;
  /** Solo en tickets: productos para poder sacar lo que no era tuyo. */
  items?: { descripcion: string; monto: number }[];
}

export interface AiResult {
  /** Casi siempre uno; varios cuando la persona contó más de un movimiento de una vez. */
  movements: AiMovement[];
  transcript?: string;
  /** Foto del ticket (data URL JPEG) para guardarla como comprobante. Solo existe del lado del cliente. */
  receipt?: string;
}

/** Acepta la respuesta nueva ({ movements }) y la vieja ({ movement }), por si la función todavía no se redeployó. */
export function normalizeAiResponse(data: unknown): Omit<AiResult, 'receipt'> | null {
  if (typeof data !== 'object' || data === null) return null;
  const payload = data as { movements?: unknown; movement?: unknown; transcript?: unknown };
  const list = Array.isArray(payload.movements) ? payload.movements : payload.movement ? [payload.movement] : [];
  const movements = list.filter((m): m is AiMovement => typeof m === 'object' && m !== null && 'tipo' in m);
  if (!movements.length) return null;
  return { movements, transcript: typeof payload.transcript === 'string' ? payload.transcript : undefined };
}

export interface AiFormFields {
  tipo: TipoMovimiento;
  amount: number | null;
  category: string;
  fuente: string;
  description: string;
  date: string;
}

/** Vuelca la sugerencia de la IA en el formulario sin pisar lo que la IA no supo (por ejemplo, el monto). */
export function applyAiMovement<T extends AiFormFields>(model: T, ai: AiMovement, categories: readonly string[]): T {
  return {
    ...model,
    tipo: ai.tipo,
    amount: ai.monto ?? model.amount,
    category: ai.tipo === 'gasto' && categories.includes(ai.categoria) ? ai.categoria : ai.tipo === 'gasto' ? 'Otros' : '',
    fuente: ai.tipo === 'ingreso' ? (ai.fuente ?? 'otro') : '',
    description: ai.descripcion || model.description,
    date: /^\d{4}-\d{2}-\d{2}$/.test(ai.fecha) ? ai.fecha : model.date,
  };
}

export type AiErrorKey =
  | 'errSessionExpired'
  | 'errAi'
  | 'errAiAudio'
  | 'errAiImage'
  | 'errAiTooLarge'
  | 'errMicDenied'
  | 'errMicUnsupported';

export function errorKeyFor(code: string | undefined): AiErrorKey {
  switch (code) {
    case 'UNAUTHORIZED':
      return 'errSessionExpired';
    case 'EMPTY_AUDIO':
      return 'errAiAudio';
    case 'BAD_IMAGE':
      return 'errAiImage';
    case 'TOO_LARGE':
      return 'errAiTooLarge';
    default:
      return 'errAi';
  }
}
