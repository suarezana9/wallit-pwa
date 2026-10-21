import { authErrorKey } from './auth-store';

describe('authErrorKey', () => {
  it('reconoce credenciales inválidas', () => {
    expect(authErrorKey('Invalid login credentials')).toBe('errInvalidCredentials');
  });

  it('devuelve null para mensajes desconocidos', () => {
    expect(authErrorKey('Algo raro')).toBeNull();
  });
});
