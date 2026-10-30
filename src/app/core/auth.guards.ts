import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth-store';

/** Acepta solo rutas internas: evita redirecciones abiertas a otros sitios. */
export function safeRedirect(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url === '/' || url === '/inicio') return null;
  return url;
}

/** Solo deja pasar con sesión iniciada; si no, manda a /login recordando a dónde quería ir. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);
  if (auth.isLoggedIn()) return true;
  const redirect = safeRedirect(state?.url);
  return inject(Router).createUrlTree(['/login'], redirect ? { queryParams: { redirect } } : {});
};

/** Para /login: si ya hay sesión, no tiene sentido mostrarlo. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/inicio']) : true;
};
