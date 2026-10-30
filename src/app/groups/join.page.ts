import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { peopleOutline } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { WallitLogoComponent } from '../shared/wallit-logo';
import { GroupsStore } from './groups-store';

@Component({
  selector: 'app-join',
  imports: [IonButton, IonContent, IonIcon, IonSpinner, RouterLink, TranslatePipe, WallitLogoComponent],
  template: `
    <ion-content>
      <div class="wrap">
        <div class="card">
          <app-wallit-logo [size]="40" />
          @if (lookup.isLoading()) {
            <ion-spinner name="crescent" />
          } @else if (target(); as group) {
            <div class="icon" aria-hidden="true"><ion-icon name="people-outline" /></div>
            <h1>{{ 'joinInviteTitle' | t }}</h1>
            <p>{{ 'joinInviteText' | t: group.name }}</p>
            @if (error(); as message) {
              <p class="wl-notice wl-notice-error" role="alert">{{ message }}</p>
            }
            <ion-button class="wl-btn wl-btn-primary" expand="block" [disabled]="busy()" (click)="join()">
              @if (busy()) {
                <ion-spinner name="crescent" />
              } @else {
                {{ 'join' | t }}
              }
            </ion-button>
            <a class="later" routerLink="/inicio">{{ 'cancel' | t }}</a>
          } @else {
            <h1>{{ 'errInvalidCode' | t }}</h1>
            <ion-button class="wl-btn wl-btn-secondary" fill="outline" routerLink="/grupos">{{ 'navGroups' | t }}</ion-button>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px 16px; }
    .card {
      width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 14px;
      padding: 32px 24px; border-radius: 20px; border: 1px solid var(--wl-field-border); text-align: center;
    }
    .icon {
      width: 56px; height: 56px; border-radius: 18px; display: grid; place-items: center; font-size: 26px;
      color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.12);
    }
    h1 { margin: 0; font-size: 21px; font-weight: 700; }
    p { margin: 0; color: var(--wl-muted); }
    ion-button { width: 100%; margin: 6px 0 0; }
    .later { font-size: 14px; font-weight: 600; color: var(--wl-muted); text-decoration: none; }
  `,
})
export class JoinPage {
  readonly code = input.required<string>();

  private readonly groups = inject(GroupsStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly toasts = inject(ToastController);

  readonly lookup = resource({
    params: () => this.code(),
    loader: ({ params }) => this.groups.findByCode(params),
  });
  readonly target = computed(() => (this.lookup.hasValue() ? this.lookup.value() : null));
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ peopleOutline });
  }

  async join(): Promise<void> {
    const group = this.target();
    if (!group) return;
    if (this.groups.list().some((g) => g.group.id === group.id)) {
      await this.router.navigate(['/grupos', group.id], { replaceUrl: true });
      return;
    }
    this.busy.set(true);
    const result = await this.groups.join(this.code());
    this.busy.set(false);
    if (result.error || !result.id) {
      this.error.set(result.error ?? this.i18n.t('errJoinGroup'));
      return;
    }
    await this.router.navigate(['/grupos', result.id], { replaceUrl: true });
    const toast = await this.toasts.create({
      message: this.i18n.t('joinedGroup', group.name),
      duration: 2200,
      position: 'top',
      color: 'dark',
    });
    await toast.present();
  }
}
