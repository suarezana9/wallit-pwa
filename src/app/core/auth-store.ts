import { Service, computed, inject, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { Supabase } from './supabase';

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
    return { error: error ? translateAuthError(error.message) : null };
  }

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await this.supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/inicio` },
    });
    return {
      error: error ? translateAuthError(error.message) : null,
      needsConfirmation: !error && !data.session,
    };
  }

  /**
   * Redirige a Google; al volver, supabase-js completa el login solo (ver Supabase).
   * prompt=select_account obliga a Google a mostrar el selector de cuentas aunque haya
   * una sola sesión abierta: en una compu compartida evita entrar con la cuenta equivocada.
   */
  async signInWithGoogle(): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/inicio`,
        queryParams: { prompt: 'select_account' },
      },
    });
    return { error: error ? translateAuthError(error.message) : null };
  }

  async sendPasswordReset(email: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
    });
    return { error: error ? translateAuthError(error.message) : null };
  }

  async updatePassword(password: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.updateUser({ password });
    return { error: error ? translateAuthError(error.message) : null };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this._session.set(null);
  }
}

/** Mismos mensajes que tenía la app de React Native. */
export function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (message.includes('Email not confirmed')) return 'Confirmá tu email antes de ingresar.';
  if (message.includes('User already registered')) return 'Ya existe una cuenta con ese email. Iniciá sesión.';
  if (message.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (message.includes('should be different from the old password')) return 'La nueva contraseña tiene que ser distinta a la anterior.';
  if (message.includes('For security purposes')) return 'Esperá unos segundos antes de pedir otro enlace.';
  if (message.toLowerCase().includes('rate limit')) return 'Se enviaron demasiados correos. Probá de nuevo en un rato.';
  return message;
}
