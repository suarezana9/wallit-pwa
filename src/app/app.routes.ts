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
    path: 'unirse/:code',
    canActivate: [authGuard],
    loadComponent: () => import('./groups/join.page').then((m) => m.JoinPage),
  },
  {
    // Destino de "Compartir con Wallit" (el service worker redirige acá después del POST).
    path: 'compartir',
    canActivate: [authGuard],
    loadComponent: () => import('./share/share.page').then((m) => m.SharePage),
  },
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
        path: 'presupuestos',
        loadComponent: () => import('./budgets/budgets.page').then((m) => m.BudgetsPage),
      },
      {
        path: 'categorias',
        loadComponent: () => import('./categories/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'grupos',
        loadComponent: () => import('./groups/groups.page').then((m) => m.GroupsPage),
      },
      {
        path: 'grupos/:id',
        loadComponent: () => import('./groups/group-detail.page').then((m) => m.GroupDetailPage),
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
