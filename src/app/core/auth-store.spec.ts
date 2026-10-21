import { translateAuthError } from './auth-store';

describe('translateAuthError', () => {
  it('traduce credenciales inválidas', () => {
    expect(translateAuthError('Invalid login credentials')).toBe('Email o contraseña incorrectos.');
  });

  it('deja pasar mensajes desconocidos', () => {
    expect(translateAuthError('Algo raro')).toBe('Algo raro');
  });
});
