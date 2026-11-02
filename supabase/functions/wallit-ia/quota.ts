// Límite de uso de la IA: interpretación de lo que devuelve consumir_ia() (migración 018).

export type QuotaKind = 'texto' | 'audio' | 'imagen';

export interface QuotaVerdict {
  /** Código de error para el cliente, o null si la consulta está permitida. */
  error: 'RATE_LIMIT_MINUTE' | 'DAILY_LIMIT' | null;
  /** Registro de uso (para devolverlo si la IA falla). */
  id: number | null;
}

export function quotaVerdict(data: unknown): QuotaVerdict {
  const value = (data ?? {}) as { ok?: boolean; motivo?: string; id?: number };
  if (value.ok === true) return { error: null, id: typeof value.id === 'number' ? value.id : null };
  return { error: value.motivo === 'minuto' ? 'RATE_LIMIT_MINUTE' : 'DAILY_LIMIT', id: null };
}

/** La función no existe (no se corrió la migración): PostgREST responde PGRST202, Postgres 42883. */
export function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883';
}
