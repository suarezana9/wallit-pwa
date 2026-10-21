import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginPage } from './login.page';
import { AuthStore } from '../core/auth-store';

describe('LoginPage', () => {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
  };

  beforeEach(() => {
    auth.signInWithPassword.mockClear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'home', children: [] }]), { provide: AuthStore, useValue: auth }],
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
});
