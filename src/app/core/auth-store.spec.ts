import { authErrorKey } from './auth-store';
import { isInAppBrowser } from '../auth/login.page';

describe('authErrorKey', () => {
  it('traduce los errores de Supabase que ve la persona', () => {
    expect(authErrorKey('Invalid login credentials')).toBe('errInvalidCredentials');
    expect(authErrorKey('Error sending confirmation email')).toBe('errEmailSend');
    expect(authErrorKey('Error sending magic link email')).toBe('errEmailSend');
    expect(authErrorKey('Database error saving new user')).toBe('errSignupDb');
    expect(authErrorKey('access_denied')).toBe('errGoogleCancelled');
    expect(authErrorKey('Unable to exchange external code: 4/0A...')).toBe('errGoogleExchange');
    expect(authErrorKey('algo nuevo')).toBeNull();
  });
});

describe('isInAppBrowser', () => {
  it('reconoce los navegadores internos donde Google no deja entrar', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) Instagram 300.0')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/400.0]')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1')).toBe(false);
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36')).toBe(false);
  });
});

describe('AuthStore.signUp', () => {
  async function storeWith(signUp: () => Promise<unknown>) {
    const { TestBed } = await import('@angular/core/testing');
    const { AuthStore } = await import('./auth-store');
    const { Supabase } = await import('./supabase');
    TestBed.configureTestingModule({ providers: [{ provide: Supabase, useValue: { client: { auth: { signUp } } } }] });
    return TestBed.inject(AuthStore);
  }

  it('avisa si el email ya tiene cuenta (Supabase responde ok pero no manda mail)', async () => {
    const store = await storeWith(async () => ({ data: { user: { id: 'u', identities: [] }, session: null }, error: null }));
    const result = await store.signUp('ana@test.com', 'secreta1');
    expect(result.needsConfirmation).toBe(false);
    expect(result.error).toContain('Ya hay una cuenta');
  });

  it('cuenta nueva: pide confirmar el email', async () => {
    const store = await storeWith(async () => ({ data: { user: { id: 'u', identities: [{ id: 'i' }] }, session: null }, error: null }));
    expect(await store.signUp('nuevo@test.com', 'secreta1')).toEqual({ error: null, needsConfirmation: true });
  });
});
