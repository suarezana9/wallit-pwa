import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NewPasswordPage } from './new-password.page';
import { AuthStore } from '../core/auth-store';

describe('NewPasswordPage', () => {
  const auth = { updatePassword: vi.fn().mockResolvedValue({ error: null }) };

  beforeEach(() => {
    auth.updatePassword.mockClear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'inicio', children: [] }]), { provide: AuthStore, useValue: auth }],
    });
  });

  it('marca error si las contraseñas no coinciden', () => {
    const page = TestBed.createComponent(NewPasswordPage).componentInstance;
    page.model.set({ password: 'secreta1', confirm: 'secreta2' });
    expect(page.passwordForm.confirm().invalid()).toBe(true);
    expect(page.passwordForm.confirm().errors()[0]?.message).toBe('Las contraseñas no coinciden.');
  });

  it('guarda cuando coinciden', async () => {
    const page = TestBed.createComponent(NewPasswordPage).componentInstance;
    page.model.set({ password: 'secreta1', confirm: 'secreta1' });
    await page.onSubmit(new Event('submit'));
    expect(auth.updatePassword).toHaveBeenCalledWith('secreta1');
  });
});
