import { Component, input, model } from '@angular/core';
import { TranslatePipe } from '../core/i18n/i18n';
import { FormValueControl } from '@angular/forms/signals';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowDownOutline, cardOutline, trendingUpOutline, walletOutline } from 'ionicons/icons';
import type { TipoMovimiento } from '../core/database.types';
import { MOVEMENT_TYPES } from './movement.model';

@Component({
  selector: 'app-type-picker',
  imports: [IonIcon, TranslatePipe],
  template: `
    <div class="types" role="radiogroup" [attr.aria-label]="'movementType' | t">
      @for (type of types; track type.id) {
        <button
          type="button"
          role="radio"
          class="type"
          [class.selected]="value() === type.id"
          [attr.aria-checked]="value() === type.id"
          [disabled]="disabled()"
          [style.--type-color]="type.color"
          (click)="value.set(type.id)"
        >
          <ion-icon [name]="type.icon" aria-hidden="true" />
          <span>{{ type.labelKey | t }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; container-type: inline-size; }
    .types { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    @container (max-width: 320px) { .types { grid-template-columns: repeat(2, 1fr); } .type { flex-direction: row; justify-content: center; padding: 10px 8px; } }
    .type {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 12px 4px; border-radius: 14px; font: inherit; font-size: 13px; font-weight: 600;
      color: var(--wl-muted); background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .type ion-icon { font-size: 20px; }
    /* Con lugar (escritorio), una fila tipo pestañas: ícono y texto en línea. */
    @container (min-width: 480px) {
      .types { gap: 6px; }
      .type { flex-direction: row; justify-content: center; gap: 8px; padding: 10px 8px; font-size: 14px; background: var(--ion-background-color, #fff); }
      .type ion-icon { font-size: 18px; }
    }
    .type.selected {
      color: var(--type-color);
      border-color: var(--type-color);
      background: color-mix(in srgb, var(--type-color) 10%, transparent);
    }
  `,
})
export class TypePickerComponent implements FormValueControl<TipoMovimiento> {
  readonly value = model<TipoMovimiento>('gasto');
  readonly disabled = input(false);
  readonly types = MOVEMENT_TYPES;

  constructor() {
    addIcons({ cardOutline, arrowDownOutline, walletOutline, trendingUpOutline });
  }
}
