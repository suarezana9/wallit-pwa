import { Service, computed, inject, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { Supabase } from './supabase';
import { I18n, TranslationKey } from './i18n/i18n';

export interface AuthResult {
  error: string | null;
}

export interface SignUpResult extends AuthResult {
  /** true si Supabase pide confirmar el email antes de poder ingresar */
  needsConfirmation: boolean;
}

/**
 * Estado de autenticación (reemplaza a authStore de Zustand + el hook useSession).
 * El signal escribible queda privado; hacia afuera solo se expone lectura.
 */
@Service()
export class AuthStore {
  private readonly supabase = inject(Supabase).client;
  private readonly i18n = inject(I18n);

  private readonly _session = signal<Session | null>(null);
  private readonly _ready = signal(false);

  readonly session = this._session.asReadonly();
  /** true cuando ya se sabe si hay sesión (después de init) */
  readonly ready = this._ready.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.user() !== null);

  /**
   * Se ejecuta una sola vez al arrancar la app (provideAppInitializer en main.ts),
   * antes de la primera navegación. Así los guards ya saben si hay sesión.
   */
  async init(): Promise<void> {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      // Ojo: no llamar a otros métodos de supabase con await dentro de este callback.
      this._session.set(session);
    });

    const { data } = await this.supabase.auth.getSession();
    this._session.set(data.session);
    this._ready.set(true);
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? this.translate(error.message) : null };
  }

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await this.supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/inicio` },
    });
    return {
      error: error ? this.translate(error.message) : null,
      needsConfirmation: !error && !data.session,
    };
  }

  /**
   * Redirige a Google; al volver, supabase-js completa el login solo (ver Supabase).
   * prompt=select_account obliga a Google a mostrar el selector de cuentas aunque haya
   * una sola sesión abierta: en una compu compartida evita entrar con la cuenta equivocada.
   */
  async signInWithGoogle(redirect = '/inicio'): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${redirect}`,
        queryParams: { prompt: 'select_account' },
      },
    });
    return { error: error ? this.translate(error.message) : null };
  }

  /**
   * Ingreso sin contraseña: Supabase manda un mail con un enlace y un código de 6 dígitos
   * (el código sirve en la app instalada, donde el enlace se abre en el navegador y no en la app).
   * Si el email no tiene cuenta, la crea.
   */
  async sendMagicLink(email: string, redirect = '/inicio'): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${redirect}`, shouldCreateUser: true },
    });
    return { error: error ? this.translate(error.message) : null };
  }

  async verifyEmailCode(email: string, code: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (!error && data.session) this._session.set(data.session);
    return { error: error ? this.translate(error.message) : null };
  }

  async sendPasswordReset(email: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    });
    return { error: error ? this.translate(error.message) : null };
  }

  async updatePassword(password: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.updateUser({ password });
    return { error: error ? this.translate(error.message) : null };
  }

  private translate(message: string): string {
    const key = authErrorKey(message);
    return key ? this.i18n.t(key) : message;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this._session.set(null);
  }
}

export function authErrorKey(message: string): TranslationKey | null {
  if (message.includes('Invalid login credentials')) return 'errInvalidCredentials';
  if (message.includes('Email not confirmed')) return 'errEmailNotConfirmed';
  if (message.includes('User already registered')) return 'errAlreadyRegistered';
  if (message.includes('Password should be')) return 'errPasswordLength';
  if (message.includes('should be different from the old password')) return 'errSamePassword';
  if (message.includes('For security purposes')) return 'errWaitSeconds';
  if (message.includes('Token has expired or is invalid') || message.includes('otp_expired')) return 'errCodeInvalid';
  if (message.toLowerCase().includes('rate limit')) return 'errRateLimit';
  return null;
}
