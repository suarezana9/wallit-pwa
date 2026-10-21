import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth-store';

/** Solo deja pasar con sesión iniciada; si no, manda a /login. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

/** Para /login: si ya hay sesión, no tiene sentido mostrarlo. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/home']) : true;
};
