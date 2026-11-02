import { Component, inject, linkedSignal, signal } from '@angular/core';
import { IonButton, IonSpinner, ToastController } from '@ionic/angular';
import { I18n, TranslatePipe, TranslationKey } from '../core/i18n/i18n';
import { ProfileStore } from '../core/profile-store';
import { aliasError, cuentaError, formatCuenta, normalizeCuenta } from '../groups/payout.model';

/** Cuenta: "Cómo te pagan". Alias y CBU/CVU (o IBAN) para que tus grupos te paguen sin preguntar. */
@Component({
  selector: 'app-payout-settings',
  imports: [IonButton, IonSpinner, TranslatePipe],
  template: `
    <section class="wl-panel" aria-labelledby="payout-title">
      <h2 id="payout-title">💸 {{ 'payoutTitle' | t }}</h2>
      <p class="hint">{{ 'payoutHint' | t }}</p>

      <label class="field">
        <span>{{ 'payoutAlias' | t }}</span>
        <input
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength="60"
          [placeholder]="'payoutAliasPlaceholder' | t"
          [value]="alias()"
          [class.bad]="aliasBad()"
          (input)="alias.set($any($event.target).value); saved.set(false)"
        />
        @if (aliasBad()) {
          <small class="error">{{ 'payoutAliasError' | t }}</small>
        }
      </label>

      <label class="field">
        <span>{{ 'payoutCuenta' | t }}</span>
        <input
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="45"
          [placeholder]="'payoutCuentaPlaceholder' | t"
          [value]="cuenta()"
          [class.bad]="!!cuentaBad()"
          (input)="cuenta.set($any($event.target).value); saved.set(false)"
          (blur)="prettify()"
        />
        @if (cuentaErrorKey(); as key) {
          <small class="error">{{ key | t }}</small>
        }
      </label>

      <div class="actions">
        @if (saved()) {
          <span class="ok">✓ {{ 'changesSaved' | t }}</span>
        }
        <ion-button class="wl-btn wl-btn-primary" size="small" [disabled]="busy() || !dirty()" (click)="save()">
          @if (busy()) {
            <ion-spinner name="crescent" />
          } @else {
            {{ 'save' | t }}
          }
        </ion-button>
      </div>
    </section>
  `,
  styles: `
    h2 { margin: 0 0 4px; font-size: 16px; font-weight: 700; }
    .hint { margin: 0 0 14px; font-size: 13px; line-height: 1.45; color: var(--wl-muted); }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .field > span { font-size: 13px; font-weight: 600; }
    input {
      height: 46px; padding: 0 14px; border-radius: 12px; font: inherit; font-size: 15px; color: inherit;
      background: var(--wl-field-bg); border: 1px solid var(--wl-field-border); outline: none;
      font-variant-numeric: tabular-nums;
    }
    input:focus { border-color: var(--ion-color-primary); box-shadow: 0 0 0 4px rgba(var(--ion-color-primary-rgb), 0.12); }
    input.bad { border-color: var(--ion-color-danger); }
    .error { font-size: 12px; color: var(--ion-color-danger); }
    .actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
    .ok { font-size: 13px; font-weight: 600; color: var(--wl-type-ingreso); }
  `,
})
export class PayoutSettingsComponent {
  private readonly profile = inject(ProfileStore);
  private readonly i18n = inject(I18n);
  private readonly toasts = inject(ToastController);

  readonly alias = linkedSignal(() => this.profile.payout().alias ?? '');
  readonly cuenta = linkedSignal(() => {
    const value = this.profile.payout().cuenta;
    return value ? formatCuenta(value) : '';
  });
  readonly busy = signal(false);
  readonly saved = signal(false);

  aliasBad(): boolean {
    return aliasError(this.alias());
  }

  cuentaBad() {
    return cuentaError(this.cuenta());
  }

  cuentaErrorKey(): TranslationKey | null {
    const error = this.cuentaBad();
    if (!error) return null;
    return ({ cbuDigits: 'payoutErrDigits', cbuCheck: 'payoutErrCheck', format: 'payoutErrFormat' } as const)[error];
  }

  dirty(): boolean {
    const current = this.profile.payout();
    return (this.alias().trim() || null) !== current.alias || (normalizeCuenta(this.cuenta()) || null) !== current.cuenta;
  }

  prettify(): void {
    const value = normalizeCuenta(this.cuenta());
    if (value && !cuentaError(value)) this.cuenta.set(formatCuenta(value));
  }

  async save(): Promise<void> {
    if (this.aliasBad() || this.cuentaBad()) return;
    this.busy.set(true);
    const ok = await this.profile.savePayout(this.alias().trim() || null, normalizeCuenta(this.cuenta()) || null);
    this.busy.set(false);
    if (ok) {
      this.saved.set(true);
      return;
    }
    const toast = await this.toasts.create({ message: this.i18n.t('errSaveChanges'), color: 'danger', duration: 2200, position: 'top' });
    await toast.present();
  }
}
