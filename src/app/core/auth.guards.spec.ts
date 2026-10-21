import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { authGuard, guestGuard } from './auth.guards';
import { AuthStore } from './auth-store';

function setup(loggedIn: boolean) {
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
