import { Component, inject, input, linkedSignal, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { formatAmountInput, parseAmount } from '../core/amount';
import { PreferencesStore } from '../core/preferences-store';

/**
 * Campo de monto: acepta coma o punto como decimal ("1.500,50", "12,5", "12.5") y muestra los miles
 * al salir del campo. Funciona con Signal Forms ([formField]) o suelto con [value] / (valueChange).
 */
@Component({
  selector: 'app-amount-input',
  template: `
    <input
      type="text"
      inputmode="decimal"
      autocomplete="off"
      enterkeyhint="done"
      [value]="text()"
      [placeholder]="placeholder()"
      [attr.aria-label]="label() || null"
      [attr.aria-invalid]="(invalid() && touched()) || null"
      [disabled]="disabled()"
      (input)="onInput($any($event.target))"
      (blur)="onBlur()"
    />
  `,
  styles: `
    :host { display: inline-block; min-width: 0; }
    input {
      width: 100%; min-width: 0; padding: 0; border: 0; outline: none; background: none;
      font: inherit; color: inherit; text-align: inherit; letter-spacing: inherit;
    }
    input::placeholder { color: inherit; opacity: 0.35; }
  `,
})
export class AmountInputComponent implements FormValueControl<number | null> {
  private readonly preferences = inject(PreferencesStore);

  readonly value = model<number | null>(null);
  readonly touched = model(false);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly placeholder = input('0');
  readonly label = input('');

  /**
   * Lo que se ve en el campo. Mientras escribís se respeta tal cual ("1," no se convierte en "1");
   * si el monto cambia desde afuera (la IA, el reparto de cuotas), se muestra formateado.
   */
  readonly text = linkedSignal<number | null, string>({
    source: this.value,
    computation: (value, previous) =>
      previous && parseAmount(previous.value, this.preferences.language()) === value
        ? previous.value
        : formatAmountInput(value, this.preferences.locale()),
  });

  onInput(field: HTMLInputElement): void {
    // Solo números, coma y punto: lo demás (letras, el signo $) se descarta al escribir.
    const clean = field.value.replace(/[^\d.,]/g, '');
    if (clean !== field.value) field.value = clean;
    this.text.set(clean);
    this.value.set(parseAmount(clean, this.preferences.language()));
  }

  onBlur(): void {
    this.touched.set(true);
    this.text.set(formatAmountInput(this.value(), this.preferences.locale()));
  }
}
