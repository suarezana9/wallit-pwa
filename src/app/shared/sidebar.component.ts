import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { homeOutline, listOutline, logOutOutline, personCircleOutline } from 'ionicons/icons';
import { AuthStore } from '../core/auth-store';
import { ProfileStore } from '../core/profile-store';
import { WallitLogoComponent } from './wallit-logo';

@Component({
  selector: 'app-sidebar',
  imports: [IonButton, IonIcon, RouterLink, RouterLinkActive, WallitLogoComponent],
  template: `
    <div class="brand">
      <app-wallit-logo [size]="32" />
      <span>Wallit</span>
    </div>

    <nav aria-label="Principal">
      <a class="nav-item" routerLink="/inicio" routerLinkActive="active">
        <ion-icon name="home-outline" aria-hidden="true" />
        Inicio
      </a>
      <a class="nav-item" routerLink="/movimientos" routerLinkActive="active">
        <ion-icon name="list-outline" aria-hidden="true" />
        Movimientos
      </a>
      <a class="nav-item" routerLink="/cuenta" routerLinkActive="active">
        <ion-icon name="person-circle-outline" aria-hidden="true" />
        Cuenta
      </a>
    </nav>

    <div class="user">
      <div class="avatar" aria-hidden="true">{{ initial() }}</div>
      <div class="user-text">
        <span class="name">{{ displayName() }}</span>
        <span class="email">{{ email() }}</span>
      </div>
      <ion-button fill="clear" color="medium" (click)="logout()" aria-label="Cerrar sesión">
        <ion-icon slot="icon-only" name="log-out-outline" />
      </ion-button>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; padding: 24px 16px 16px; }
    .brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 28px; font-size: 19px; font-weight: 700; letter-spacing: -0.02em; }
    nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .nav-item {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px;
      color: var(--wl-muted); font-weight: 600; text-decoration: none;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .nav-item ion-icon { font-size: 19px; }
    .nav-item:hover { background: var(--wl-field-bg); color: var(--ion-text-color); }
    .nav-item.active { background: rgba(var(--ion-color-primary-rgb), 0.1); color: var(--ion-color-primary); }
    .user {
      display: flex; align-items: center; gap: 10px; padding: 10px 4px 10px 10px;
      border-radius: 14px; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
    }
    .avatar {
      flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
      font-weight: 700; color: #fff; background: var(--ion-color-primary);
    }
    .user-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .name, .email { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name { font-size: 14px; font-weight: 600; }
    .email { font-size: 12px; color: var(--wl-muted); }
  `,
})
export class SidebarComponent {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly displayName = inject(ProfileStore).displayName;
  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly initial = computed(() => (this.displayName() || this.email()).charAt(0).toUpperCase());

  constructor() {
    addIcons({ homeOutline, listOutline, logOutOutline, personCircleOutline });
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
