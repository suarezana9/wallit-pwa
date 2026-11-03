import { currencyForTimeZone, guessCurrency, resolveCurrency } from './currencies';

describe('moneda inicial', () => {
  it('la zona horaria gana al idioma (iPhone en español de España usado en Argentina)', () => {
    expect(guessCurrency('America/Argentina/Buenos_Aires', ['es-ES'])).toBe('ARS');
    expect(guessCurrency('Europe/Madrid', ['es-AR'])).toBe('EUR');
    expect(currencyForTimeZone('America/Argentina/Cordoba')).toBe('ARS');
    expect(currencyForTimeZone('Australia/Sydney')).toBe('AUD');
  });

  it('sin zona conocida usa la región del idioma y si no, pesos argentinos', () => {
    expect(guessCurrency('Etc/UTC', ['es', 'es-MX'])).toBe('MXN');
    expect(guessCurrency('', ['es'])).toBe('ARS');
  });

  it('corrige el euro que la regla vieja guardó solo por el idioma', () => {
    expect(resolveCurrency({ stored: 'EUR', chosen: false, timeZone: 'America/Argentina/Buenos_Aires', languages: ['es-ES'] })).toBe('ARS');
  });

  it('respeta lo que la persona eligió o cambió a mano', () => {
    expect(resolveCurrency({ stored: 'EUR', chosen: true, timeZone: 'America/Argentina/Buenos_Aires', languages: ['es-ES'] })).toBe('EUR');
    // USD no sale del idioma es-ES: tuvo que elegirlo a mano antes de que existiera la marca.
    expect(resolveCurrency({ stored: 'USD', chosen: false, timeZone: 'America/Argentina/Buenos_Aires', languages: ['es-ES'] })).toBe('USD');
  });

  it('sin nada guardado, adivina', () => {
    expect(resolveCurrency({ stored: null, chosen: false, timeZone: 'America/Santiago', languages: ['es-ES'] })).toBe('CLP');
  });
});
