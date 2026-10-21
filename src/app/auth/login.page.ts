import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FieldTree, FormField, email, form, minLength, required, submit,
} from '@angular/forms/signals';
import {
  IonButton, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonLabel,
  IonSegment, IonSegmentButton, IonSpinner, SegmentCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logoGoogle } from 'ionicons/icons';
import { AuthStore } from '../core/auth-store';
import { WallitLogoComponent } from '../shared/wallit-logo';

type Mode = 'login' | 'registro';

@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  imports: [
    FormField, IonButton, IonContent, IonIcon, IonInput, IonInputPasswordToggle,
    IonLabel, IonSegment, IonSegmentButton, IonSpinner, WallitLogoComponent,
  ],
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly mode = signal<Mode>('login');
  readonly serverError = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly googleLoading = signal(false);

  readonly credentials = signal({ email: '', password: '' });
  readonly loginForm = form(this.credentials, (path) => {
    required(path.email, { message: 'Ingresá tu email.' });
    email(path.email, { message: 'El email no es válido.' });
    required(path.password, { message: 'Ingresá tu contraseña.' });
    minLength(path.password, 6, { message: 'Mínimo 6 caracteres.' });
  });

  constructor() {
    addIcons({ logoGoogle });
  }

  onModeChange(event: SegmentCustomEvent): void {
    this.mode.set(event.detail.value === 'registro' ? 'registro' : 'login');
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

      if (this.mode() === 'login') {
        const { error } = await this.auth.signInWithPassword(email, password);
        if (error) {
          this.serverError.set(error);
          return;
        }
        await this.router.navigateByUrl('/home', { replaceUrl: true });
        return;
      }

      const { error, needsConfirmation } = await this.auth.signUp(email, password);
      if (error) {
        this.serverError.set(error);
      } else if (needsConfirmation) {
        this.info.set(`Te mandamos un enlace de confirmación a ${email.trim()}. Abrilo para activar tu cuenta.`);
      } else {
        await this.router.navigateByUrl('/home', { replaceUrl: true });
      }
    });
  }

  async onGoogle(): Promise<void> {
    this.serverError.set(null);
    this.googleLoading.set(true);
    const { error } = await this.auth.signInWithGoogle();
    if (error) {
      this.serverError.set(error);
      this.googleLoading.set(false);
    }
  }
}
