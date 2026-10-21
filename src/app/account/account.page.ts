import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';
import { AuthStore } from '../core/auth-store';
import { ProfileStore } from '../core/profile-store';

@Component({
  selector: 'app-account',
  imports: [IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar],
  template: `
    <ion-header class="ion-no-border ion-hide-lg-up">
      <ion-toolbar>
        <ion-title>Cuenta</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="wl-page">
        <header class="wl-page-header ion-hide-lg-down">
          <div class="wl-page-title">
            <h1>Cuenta</h1>
            <p>Tus datos de acceso a Wallit.</p>
          </div>
        </header>

        <section class="wl-panel profile">
          <div class="avatar" aria-hidden="true">{{ initial() }}</div>
          <div class="who">
            <span class="name">{{ displayName() }}</span>
            <span class="email">{{ email() }}</span>
          </div>
        </section>

        <ion-button class="wl-btn wl-btn-secondary logout" fill="outline" expand="block" (click)="logout()">
          <ion-icon slot="start" name="log-out-outline" />
          Cerrar sesión
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: `
    .profile, .logout { max-width: 560px; }
    .profile { display: flex; align-items: center; gap: 14px; margin: 8px 0 20px; }
    .avatar {
      flex: none; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center;
      font-size: 22px; font-weight: 700; color: #fff; background: var(--ion-color-primary);
    }
    .who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .name { font-size: 18px; font-weight: 700; }
    .email { color: var(--wl-muted); overflow: hidden; text-overflow: ellipsis; }
    .logout { --color: var(--ion-color-danger); }
    @media (max-width: 991.98px) { .profile { padding: 16px; border-radius: 16px; border: 1px solid var(--wl-field-border); } }
    @media (min-width: 992px) { .logout { max-width: 240px; } }
    @media (max-width: 991.98px) { .profile { margin-top: 8px; } }
  `,
})
export class AccountPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly displayName = inject(ProfileStore).displayName;
  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly initial = computed(() => (this.displayName() || this.email()).charAt(0).toUpperCase());

  constructor() {
    addIcons({ logOutOutline });
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
