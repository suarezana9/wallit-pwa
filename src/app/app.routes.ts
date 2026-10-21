import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'nueva-contrasena',
    canActivate: [authGuard],
    loadComponent: () => import('./auth/new-password.page').then((m) => m.NewPasswordPage),
  },
  { path: 'home', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'inicio',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'movimientos',
        loadComponent: () => import('./movements/movements.page').then((m) => m.MovementsPage),
      },
      {
        path: 'cuenta',
        loadComponent: () => import('./account/account.page').then((m) => m.AccountPage),
      },
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'inicio' },
];
