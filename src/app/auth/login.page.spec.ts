import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginPage } from './login.page';
import { AuthStore } from '../core/auth-store';

describe('LoginPage', () => {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    sendPasswordReset: vi.fn().mockResolvedValue({ error: null }),
    sendMagicLink: vi.fn().mockResolvedValue({ error: null }),
    verifyEmailCode: vi.fn().mockResolvedValue({ error: null }),
  };

  beforeEach(() => {
    auth.signInWithPassword.mockClear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'inicio', children: [] }]), { provide: AuthStore, useValue: auth }],
    });
  });

  it('marca inválido un email mal escrito', () => {
    const page = TestBed.createComponent(LoginPage).componentInstance;
    page.credentials.set({ email: 'no-es-un-mail', password: '123456' });
    expect(page.loginForm.email().invalid()).toBe(true);
    expect(page.loginForm.password().valid()).toBe(true);
  });

  it('no llama a Supabase si el form es inválido', async () => {
    const page = TestBed.createComponent(LoginPage).componentInstance;
    await page.onSubmit(new Event('submit'));
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(page.errorOf(page.loginForm.email)).toBe('Ingresá tu email.');
  });

  it('ingresa con datos válidos', async () => {
    const page = TestBed.createComponent(LoginPage).componentInstance;
    page.credentials.set({ email: 'ana@mail.com', password: '123456' });
    await page.onSubmit(new Event('submit'));
    expect(auth.signInWithPassword).toHaveBeenCalledWith('ana@mail.com', '123456');
  });

  it('enlace mágico: pide el email, manda el código y entra con 6 dígitos', async () => {
    const page = TestBed.createComponent(LoginPage).componentInstance;
    page.go('magic');
    await page.sendMagic(new Event('submit'));
    expect(auth.sendMagicLink).not.toHaveBeenCalled();
    page.credentials.set({ email: 'ana@mail.com', password: '' });
    await page.sendMagic(new Event('submit'));
    expect(auth.sendMagicLink).toHaveBeenCalledWith('ana@mail.com', '/inicio');
    expect(page.codeSentTo()).toBe('ana@mail.com');
    expect(page.cooldown()).toBe(60);
    const field = document.createElement('input');
    field.value = '12 34 56';
    page.onCode(field);
    await Promise.resolve();
    expect(auth.verifyEmailCode).toHaveBeenCalledWith('ana@mail.com', '123456');
  });

  it('en modo recuperar solo pide el email y manda el enlace', async () => {
    const page = TestBed.createComponent(LoginPage).componentInstance;
    page.setMode('recuperar');
    page.credentials.set({ email: 'ana@mail.com', password: '' });
    await page.onSubmit(new Event('submit'));
    expect(auth.sendPasswordReset).toHaveBeenCalledWith('ana@mail.com');
    expect(page.info()).toContain('ana@mail.com');
  });
});
