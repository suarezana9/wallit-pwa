import { amountForClipboard, formatAmountInput, parseAmount } from './amount';

describe('amount', () => {
  it('acepta coma o punto como decimal', () => {
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('49352,25')).toBe(49352.25);
    expect(parseAmount('0,99')).toBe(0.99);
  });

  it('separador de miles', () => {
    expect(parseAmount('1.500')).toBe(1500);
    expect(parseAmount('1.500', 'en')).toBe(1.5);
    expect(parseAmount('1.200.000')).toBe(1200000);
    expect(parseAmount('1,200,000')).toBe(1200000);
    expect(parseAmount('0.500')).toBe(0.5);
  });

  it('casos raros', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(',')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('$ 1.234,5')).toBe(1234.5);
    expect(parseAmount('12,345')).toBe(12.35);
    expect(parseAmount('1,')).toBe(1);
  });

  it('formatea para mostrar y para copiar', () => {
    expect(formatAmountInput(1234.5, 'es-AR')).toBe('1.234,5');
    expect(formatAmountInput(null, 'es-AR')).toBe('');
    expect(amountForClipboard(152300.5)).toBe('152300,50');
    expect(amountForClipboard(152300.5, 'en')).toBe('152300.50');
    expect(amountForClipboard(1500)).toBe('1500');
  });
});
