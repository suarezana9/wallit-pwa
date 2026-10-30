import type { MovementInput } from '../movements/movement.model';

export const RECEIPTS_BUCKET = 'receipts';

/** Estado del comprobante en el formulario: el que ya estaba guardado, una foto nueva o ninguno. */
export type ReceiptDraft = { kind: 'stored'; ref: string } | { kind: 'new'; dataUrl: string } | null;

export interface MovementSave {
  input: MovementInput;
  receipt: ReceiptDraft;
}

export interface ReceiptPlan {
  /** Foto nueva para subir antes de guardar el movimiento. */
  upload: string | null;
  /** Comprobante que sigue igual. */
  keep: string | null;
  /** Archivo viejo para borrar del bucket una vez guardado el movimiento. */
  discard: string | null;
}

export function draftFor(ref: string | null | undefined): ReceiptDraft {
  return ref ? { kind: 'stored', ref } : null;
}

/** Decide qué hacer con el bucket comparando el comprobante guardado con lo que quedó en el formulario. */
export function receiptPlan(previous: string | null, draft: ReceiptDraft): ReceiptPlan {
  if (draft?.kind === 'new') return { upload: draft.dataUrl, keep: null, discard: previous };
  if (draft?.kind === 'stored' && draft.ref === previous) return { upload: null, keep: previous, discard: null };
  return { upload: null, keep: null, discard: previous };
}

/**
 * La app de React Native guardaba URLs completas; la web guarda la ruta dentro del bucket privado
 * ("<user_id>/<uuid>.jpg") y genera una URL firmada cada vez que hace falta.
 */
export function isExternalUrl(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

export function receiptPath(userId: string, id: string, type: string): string {
  const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return `${userId}/${id}.${extension}`;
}
