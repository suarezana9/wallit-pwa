import { aliasError, cuentaError, formatCuenta, isValidCbu, isValidIban, normalizeCuenta, reminderText } from './payout.model';

describe('payout.model', () => {
  it('valida el dígito verificador del CBU/CVU', () => {
    expect(isValidCbu('2850590940090418135201')).toBe(true);
    expect(isValidCbu('2850590940090418135202')).toBe(false);
    expect(isValidCbu('285059094009041813520')).toBe(false);
  });

  it('valida IBAN', () => {
    expect(isValidIban('ES9121000418450200051332')).toBe(true);
    expect(isValidIban('ES9121000418450200051333')).toBe(false);
  });

  it('errores amigables y normalización', () => {
    expect(normalizeCuenta('2850 5909-4009.0418 135201')).toBe('2850590940090418135201');
    expect(cuentaError('2850 5909 4009 0418 1352 01')).toBeNull();
    expect(cuentaError('12345')).toBe('cbuDigits');
    expect(cuentaError('2850590940090418135202')).toBe('cbuCheck');
    expect(cuentaError('es91 2100 0418 4502 0005 1332')).toBeNull();
    expect(cuentaError('hola mundo')).toBe('format');
    expect(cuentaError('')).toBeNull();
    expect(aliasError('ab')).toBe(true);
    expect(aliasError('ana.casa.wallit')).toBe(false);
    expect(aliasError('')).toBe(false);
  });

  it('formatea de a 4 y arma el recordatorio', () => {
    expect(formatCuenta('2850590940090418135201')).toBe('2850 5909 4009 0418 1352 01');
    const text = reminderText({
      debtor: 'Sol', group: 'Casa', amount: '$13.000',
      mine: { alias: 'ana.casa', cuenta: null },
      labels: { greeting: (n, g, a) => `Hola ${n}! En ${g} me debés ${a}.`, alias: 'Alias', cuenta: 'CBU/CVU' },
    });
    expect(text).toBe('Hola Sol! En Casa me debés $13.000.\nAlias: ana.casa');
  });
});
