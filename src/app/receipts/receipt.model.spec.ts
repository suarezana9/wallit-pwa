import { draftFor, isExternalUrl, receiptPath, receiptPlan } from './receipt.model';

describe('receipt.model', () => {
  it('sin cambios conserva el comprobante', () => {
    expect(receiptPlan('u/1.jpg', draftFor('u/1.jpg'))).toEqual({ upload: null, keep: 'u/1.jpg', discard: null });
  });

  it('una foto nueva se sube y la vieja se borra', () => {
    expect(receiptPlan('u/1.jpg', { kind: 'new', dataUrl: 'data:x' })).toEqual({ upload: 'data:x', keep: null, discard: 'u/1.jpg' });
    expect(receiptPlan(null, { kind: 'new', dataUrl: 'data:x' })).toEqual({ upload: 'data:x', keep: null, discard: null });
  });

  it('quitar el comprobante lo borra', () => {
    expect(receiptPlan('u/1.jpg', null)).toEqual({ upload: null, keep: null, discard: 'u/1.jpg' });
    expect(receiptPlan(null, null)).toEqual({ upload: null, keep: null, discard: null });
  });

  it('distingue URLs viejas de rutas del bucket y arma la ruta por usuario', () => {
    expect(isExternalUrl('https://x.supabase.co/storage/v1/object/public/a.jpg')).toBe(true);
    expect(isExternalUrl('abc/1.jpg')).toBe(false);
    expect(receiptPath('abc', 'id1', 'image/jpeg')).toBe('abc/id1.jpg');
    expect(receiptPath('abc', 'id1', 'image/png')).toBe('abc/id1.png');
  });
});
