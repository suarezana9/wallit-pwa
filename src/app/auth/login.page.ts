import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FieldTree, FormField, email, form, minLength, required, submit,
} from '@angular/forms/signals';
import {
  IonButton, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonLabel,
  IonSegment, IonSegmentButton, IonSpinner, SegmentCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { flashOutline, logoGoogle, pieChartOutline, walletOutline } from 'ionicons/icons';
import { AuthStore } from '../core/auth-store';
import { safeRedirect } from '../core/auth.guards';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { WallitLogoComponent } from '../shared/wallit-logo';

type Mode = 'login' | 'registro' | 'recuperar';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  imports: [
    FormField, IonButton, IonContent, IonIcon, IonInput, IonInputPasswordToggle,
    IonLabel, IonSegment, IonSegmentButton, IonSpinner, TranslatePipe, WallitLogoComponent,
  ],
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly redirect =
    safeRedirect(inject(ActivatedRoute).snapshot.queryParamMap.get('redirect')) ?? '/inicio';

  readonly mode = signal<Mode>('login');
  readonly serverError = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly googleLoading = signal(false);
  readonly submitLabel = computed(() => {
    const keys = { login: 'tabLogin', registro: 'tabSignup', recuperar: 'sendLink' } as const;
    return this.i18n.t(keys[this.mode()]);
  });

  readonly credentials = signal({ email: '', password: '' });
  readonly loginForm = form(this.credentials, (path) => {
    required(path.email, { message: () => this.i18n.t('errEmailRequired') });
    email(path.email, { message: () => this.i18n.t('errEmailInvalid') });
    required(path.password, { message: () => this.i18n.t('errPasswordRequired'), when: () => this.mode() !== 'recuperar' });
    minLength(path.password, 6, { message: () => this.i18n.t('errPasswordMin'), when: () => this.mode() !== 'recuperar' });
  });

  constructor() {
    addIcons({ flashOutline, logoGoogle, pieChartOutline, walletOutline });
  }

  onModeChange(event: SegmentCustomEvent): void {
    this.setMode(event.detail.value === 'registro' ? 'registro' : 'login');
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.serverError.set(null);
    this.info.set(null);
  }

  errorOf(field: FieldTree<string>): string {
    const state = field();
    if (!state.touched()) return '';
    return state.errors()[0]?.message ?? '';
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.serverError.set(null);
    this.info.set(null);

    await submit(this.loginForm, async () => {
      const { email, password } = this.credentials();

      if (this.mode() === 'recuperar') {
        const { error } = await this.auth.sendPasswordReset(email);
        if (error) {
          this.serverError.set(error);
        } else {
          this.info.set(this.i18n.t('recoverSent', email.trim()));
        }
        return;
      }

      if (this.mode() === 'login') {
        const { error } = await this.auth.signInWithPassword(email, password);
        if (error) {
          this.serverError.set(error);
          return;
        }
        await this.router.navigateByUrl(this.redirect, { replaceUrl: true });
        return;
      }

      const { error, needsConfirmation } = await this.auth.signUp(email, password);
      if (error) {
        this.serverError.set(error);
      } else if (needsConfirmation) {
        this.info.set(this.i18n.t('confirmSent', email.trim()));
      } else {
        await this.router.navigateByUrl(this.redirect, { replaceUrl: true });
      }
    });
  }

  async onGoogle(): Promise<void> {
    this.serverError.set(null);
    this.googleLoading.set(true);
    const { error } = await this.auth.signInWithGoogle(this.redirect);
    if (error) {
      this.serverError.set(error);
      this.googleLoading.set(false);
    }
  }
}
