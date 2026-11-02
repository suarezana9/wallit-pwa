import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FieldTree, FormField, email, form, minLength, required, submit,
} from '@angular/forms/signals';
import {
  IonButton, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonLabel,
  IonSegment, IonSegmentButton, IonSpinner, SegmentCustomEvent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { flashOutline, logoGoogle, mailOutline, pieChartOutline, sparkles, walletOutline } from 'ionicons/icons';
import { AuthStore } from '../core/auth-store';
import { safeRedirect } from '../core/auth.guards';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { WallitLogoComponent } from '../shared/wallit-logo';

type Mode = 'login' | 'registro' | 'recuperar';
/** choose: elegir cómo entrar · magic: enlace o código por mail · password: email y contraseña. */
type Step = 'choose' | 'magic' | 'password';

const RESEND_SECONDS = 60;

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
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  private readonly redirect = safeRedirect(this.query.get('redirect')) ?? '/inicio';

  readonly step = signal<Step>('choose');
  /** Viene de "Ya tengo cuenta" en la bienvenida: cambia el saludo. */
  readonly returning = signal(this.query.get('modo') === 'login');
  readonly busy = signal(false);
  readonly codeSentTo = signal<string | null>(null);
  readonly code = signal('');
  readonly cooldown = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

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
    addIcons({ flashOutline, logoGoogle, mailOutline, pieChartOutline, sparkles, walletOutline });
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  go(step: Step): void {
    this.step.set(step);
    this.serverError.set(null);
    this.info.set(null);
  }

  // ---------- Enlace mágico / código ----------

  async sendMagic(event: Event): Promise<void> {
    event.preventDefault();
    this.serverError.set(null);
    const field = this.loginForm.email();
    field.markAsTouched();
    if (field.invalid()) return;
    await this.requestCode(this.credentials().email.trim());
  }

  async resend(): Promise<void> {
    const email = this.codeSentTo();
    if (email) await this.requestCode(email);
  }

  private async requestCode(email: string): Promise<void> {
    this.busy.set(true);
    const { error } = await this.auth.sendMagicLink(email, this.redirect);
    this.busy.set(false);
    if (error) {
      this.serverError.set(error);
      return;
    }
    this.codeSentTo.set(email);
    this.code.set('');
    this.startCooldown();
  }

  /** Solo dígitos; con 6 se verifica solo (también al pegar el código desde el mail). */
  onCode(field: HTMLInputElement): void {
    const digits = field.value.replace(/\D/g, '').slice(0, 8);
    if (digits !== field.value) field.value = digits;
    this.code.set(digits);
    this.serverError.set(null);
    if (digits.length === 6 && !this.busy()) void this.verifyCode();
  }

  async verifyCode(event?: Event): Promise<void> {
    event?.preventDefault();
    const email = this.codeSentTo();
    if (!email || this.code().length < 6) return;
    this.busy.set(true);
    const { error } = await this.auth.verifyEmailCode(email, this.code());
    this.busy.set(false);
    if (error) {
      this.serverError.set(error);
      return;
    }
    await this.router.navigateByUrl(this.redirect, { replaceUrl: true });
  }

  private startCooldown(): void {
    this.stopTimer();
    this.cooldown.set(RESEND_SECONDS);
    this.timer = setInterval(() => {
      this.cooldown.update((s) => Math.max(0, s - 1));
      if (this.cooldown() === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
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
