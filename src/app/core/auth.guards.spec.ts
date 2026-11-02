import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { authGuard, guestGuard, safeRedirect } from './auth.guards';
import { AuthStore } from './auth-store';

function setup(loggedIn: boolean, introDone = true) {
  if (introDone) localStorage.setItem('wallit_intro_vista', '1');
  else localStorage.removeItem('wallit_intro_vista');
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthStore, useValue: { isLoggedIn: signal(loggedIn) } },
    ],
  });
  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard({} as never, {} as never));
  return { run, router: TestBed.inject(Router) };
}

describe('authGuard', () => {
  it('deja pasar con sesión', () => {
    const { run } = setup(true);
    expect(run(authGuard)).toBe(true);
  });

  it('manda a /login sin sesión', () => {
    const { run, router } = setup(false);
    const result = run(authGuard) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/login');
  });

  it('la primera vez muestra la bienvenida antes del login', () => {
    const { run, router } = setup(false, false);
    expect(router.serializeUrl(run(authGuard) as UrlTree)).toBe('/bienvenida');
  });

  it('recuerda el destino para volver después del login', () => {
    const { router } = setup(false);
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/unirse/ab12' } as never)) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/login?redirect=%2Funirse%2Fab12');
  });

  it('ignora destinos externos', () => {
    expect(safeRedirect('//evil.com')).toBeNull();
    expect(safeRedirect('https://evil.com')).toBeNull();
    expect(safeRedirect('/grupos')).toBe('/grupos');
  });
});

describe('guestGuard', () => {
  it('deja ver /login sin sesión', () => {
    const { run } = setup(false);
    expect(run(guestGuard)).toBe(true);
  });

  it('manda a /inicio si ya hay sesión', () => {
    const { run, router } = setup(true);
    const result = run(guestGuard) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/inicio');
  });
});
