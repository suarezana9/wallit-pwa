import { Component, computed, input, linkedSignal, output } from '@angular/core';
import {
  FieldTree, FormField, form, hidden, maxLength, min, required, submit,
} from '@angular/forms/signals';
import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { toIsoDate } from '../core/dates';
import type { FuenteIngreso, Movimiento, TipoMovimiento } from '../core/database.types';
import { ChipOption, ChipPickerComponent } from './chip-picker.component';
import { TypePickerComponent } from './type-picker.component';
import { CATEGORIES, INCOME_SOURCES, MovementInput, typeInfo } from './movement.model';

export interface MovementFormModel {
  tipo: TipoMovimiento;
  amount: number | null;
  category: string;
  fuente: string;
  description: string;
  date: string;
}

export function toFormModel(movement: Movimiento | null): MovementFormModel {
  if (!movement) {
    return { tipo: 'gasto', amount: null, category: '', fuente: '', description: '', date: toIsoDate(new Date()) };
  }
  return {
    tipo: movement.tipo,
    amount: Number(movement.amount),
    category: movement.tipo === 'gasto' ? movement.category : '',
    fuente: movement.fuente ?? '',
    description: movement.description,
    date: movement.date,
  };
}

export function toMovementInput(model: MovementFormModel): MovementInput {
  return {
    tipo: model.tipo,
    amount: Number(model.amount),
    category: model.tipo === 'gasto' ? model.category : 'Otros',
    fuente: model.tipo === 'ingreso' ? (model.fuente as FuenteIngreso) : null,
    description: model.description.trim(),
    date: model.date,
  };
}

@Component({
  selector: 'app-movement-form',
  templateUrl: 'movement-form.component.html',
  styleUrls: ['movement-form.component.scss'],
  host: { class: 'ion-page' },
  imports: [
    ChipPickerComponent, FormField, IonButton, IonButtons, IonContent, IonHeader, IonIcon,
    IonInput, IonSpinner, IonTitle, IonToolbar, TypePickerComponent,
  ],
})
export class MovementFormComponent {
  readonly movement = input<Movimiento | null>(null);
  readonly saving = input(false);

  readonly save = output<MovementInput>();
  readonly remove = output<string>();
  readonly dismiss = output<void>();

  readonly model = linkedSignal(() => toFormModel(this.movement()));

  readonly movementForm = form(this.model, (path) => {
    required(path.amount, { message: 'Ingresá el monto.' });
    min(path.amount, 0.01, { message: 'El monto tiene que ser mayor a cero.' });
    hidden(path.category, ({ valueOf }) => valueOf(path.tipo) !== 'gasto');
    required(path.category, {
      message: 'Elegí una categoría.',
      when: ({ valueOf }) => valueOf(path.tipo) === 'gasto',
    });
    hidden(path.fuente, ({ valueOf }) => valueOf(path.tipo) !== 'ingreso');
    required(path.fuente, {
      message: 'Elegí de dónde viene.',
      when: ({ valueOf }) => valueOf(path.tipo) === 'ingreso',
    });
    maxLength(path.description, 120, { message: 'Máximo 120 caracteres.' });
    required(path.date, { message: 'Elegí una fecha.' });
  });

  readonly isEdit = computed(() => this.movement() !== null);
  readonly currentType = computed(() => typeInfo(this.model().tipo));
  readonly saveLabel = computed(() => `Guardar ${this.currentType().label.toLowerCase()}`);
  readonly amountWidth = computed(() => Math.max(2, String(this.model().amount ?? '').length + 1));

  readonly categoryOptions: ChipOption[] = CATEGORIES.map((c) => ({ value: c.name, label: c.name, emoji: c.emoji }));
  readonly sourceOptions: ChipOption[] = INCOME_SOURCES.map((s) => ({ value: s.id, label: s.label }));

  constructor() {
    addIcons({ closeOutline });
  }

  errorOf(field: FieldTree<unknown>): string {
    const state = field();
    if (!state.touched()) return '';
    return state.errors()[0]?.message ?? '';
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.movementForm, async () => {
      this.save.emit(toMovementInput(this.model()));
    });
  }

  onRemove(): void {
    const movement = this.movement();
    if (movement) this.remove.emit(movement.id);
  }
}
