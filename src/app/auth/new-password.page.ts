import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FieldTree, FormField, form, minLength, required, submit, validate } from '@angular/forms/signals';
import { IonButton, IonContent, IonInput, IonInputPasswordToggle, IonSpinner, ToastController } from '@ionic/angular';
import { AuthStore } from '../core/auth-store';
import { WallitLogoComponent } from '../shared/wallit-logo';

@Component({
  selector: 'app-new-password',
  templateUrl: 'new-password.page.html',
  styleUrls: ['login.page.scss'],
  imports: [FormField, IonButton, IonContent, IonInput, IonInputPasswordToggle, IonSpinner, WallitLogoComponent],
})
export class NewPasswordPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastController);

  readonly serverError = signal<string | null>(null);
  readonly model = signal({ password: '', confirm: '' });
  readonly passwordForm = form(this.model, (path) => {
    required(path.password, { message: 'Ingresá la nueva contraseña.' });
    minLength(path.password, 6, { message: 'Mínimo 6 caracteres.' });
    required(path.confirm, { message: 'Repetí la contraseña.' });
    validate(path.confirm, ({ value, valueOf }) =>
      value() && value() !== valueOf(path.password)
        ? { kind: 'mismatch', message: 'Las contraseñas no coinciden.' }
        : undefined,
    );
  });

  errorOf(field: FieldTree<string>): string {
    const state = field();
    if (!state.touched()) return '';
    return state.errors()[0]?.message ?? '';
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.serverError.set(null);
    await submit(this.passwordForm, async () => {
      const { error } = await this.auth.updatePassword(this.model().password);
      if (error) {
        this.serverError.set(error);
        return;
      }
      const toast = await this.toasts.create({ message: 'Contraseña actualizada', duration: 2200, position: 'top' });
      await toast.present();
      await this.router.navigateByUrl('/inicio', { replaceUrl: true });
    });
  }
}
