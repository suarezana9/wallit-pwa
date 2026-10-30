import { excludedTotal, fromTicket, hasAdjustments, netAmount, parseDetalle, toJson, withAmount } from './detalle.model';

describe('detalle.model', () => {
  const ticket = fromTicket(49352.25, [
    { descripcion: 'Leche condensada', monto: 3500 },
    { descripcion: 'Aceite de oliva', monto: 11474.25 },
  ])!;

  it('descuenta lo que no era tuyo y los reintegros', () => {
    expect(netAmount(ticket)).toBe(49352.25);
    const sinLeche = { ...ticket, items: ticket.items.map((i, n) => ({ ...i, excluido: n === 0 })) };
    expect(excludedTotal(sinLeche)).toBe(3500);
    expect(netAmount(sinLeche)).toBe(45852.25);
    expect(netAmount({ ...sinLeche, reintegro: 9800 })).toBe(36052.25);
    expect(hasAdjustments(ticket)).toBe(false);
    expect(hasAdjustments({ ...ticket, reintegro: 1 })).toBe(true);
    expect(netAmount({ ...ticket, reintegro: 999999 })).toBe(0);
  });

  it('si cambian el monto a mano, el total se reacomoda', () => {
    const conReintegro = { ...ticket, reintegro: 9800 };
    const editado = withAmount(conReintegro, 40000);
    expect(netAmount(editado)).toBe(40000);
    expect(editado.total).toBe(49800);
    expect(withAmount(conReintegro, netAmount(conReintegro))).toBe(conReintegro);
  });

  it('se guarda y se lee de la base', () => {
    const json = toJson({ ...ticket, reintegro: 9800, reintegro_nota: 'MODO' });
    expect(parseDetalle(json)).toEqual({ ...ticket, reintegro: 9800, reintegro_nota: 'MODO' });
    expect(toJson({ total: 100, items: [], reintegro: 0, reintegro_nota: '' })).toBeNull();
    expect(parseDetalle(null)).toBeNull();
    expect(parseDetalle({ total: 'x' })).toBeNull();
    expect(fromTicket(100, [])).toBeNull();
  });
});
