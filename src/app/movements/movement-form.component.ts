import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import {
  FieldTree, FormField, form, hidden, maxLength, min, required, submit,
} from '@angular/forms/signals';
import {
  IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { toIsoDate } from '../core/dates';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import type { FuenteIngreso, Movimiento, TipoMovimiento } from '../core/database.types';
import { CategoryPickerComponent } from './category-picker.component';
import { ChipOption, ChipPickerComponent } from './chip-picker.component';
import { TypePickerComponent } from './type-picker.component';
import { INCOME_SOURCES, MovementInput, typeInfo } from './movement.model';

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
    CategoryPickerComponent, ChipPickerComponent, FormField, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon,
    IonInput, IonSpinner, IonTitle, IonToolbar, TranslatePipe, TypePickerComponent,
  ],
})
export class MovementFormComponent {
  private readonly i18n = inject(I18n);
  readonly preferences = inject(PreferencesStore);

  readonly movement = input<Movimiento | null>(null);
  readonly saving = input(false);

  readonly save = output<MovementInput>();
  readonly remove = output<string>();
  readonly dismiss = output<void>();

  readonly model = linkedSignal(() => toFormModel(this.movement()));

  readonly movementForm = form(this.model, (path) => {
    required(path.amount, { message: () => this.i18n.t('errAmountRequired') });
    min(path.amount, 0.01, { message: () => this.i18n.t('errAmountPositive') });
    hidden(path.category, ({ valueOf }) => valueOf(path.tipo) !== 'gasto');
    required(path.category, {
      message: () => this.i18n.t('errCategory'),
      when: ({ valueOf }) => valueOf(path.tipo) === 'gasto',
    });
    hidden(path.fuente, ({ valueOf }) => valueOf(path.tipo) !== 'ingreso');
    required(path.fuente, {
      message: () => this.i18n.t('errSource'),
      when: ({ valueOf }) => valueOf(path.tipo) === 'ingreso',
    });
    maxLength(path.description, 120, { message: () => this.i18n.t('errDescriptionMax') });
    required(path.date, { message: () => this.i18n.t('errDate') });
  });

  readonly isEdit = computed(() => this.movement() !== null);
  readonly currentType = computed(() => typeInfo(this.model().tipo));
  readonly saveLabel = computed(() => this.i18n.t('saveType', this.i18n.t(this.currentType().labelKey).toLowerCase()));
  readonly amountWidth = computed(() => Math.max(2, String(this.model().amount ?? '').length + 1));

  readonly sourceOptions = computed<ChipOption[]>(() =>
    INCOME_SOURCES.map((s) => ({ value: s.id, label: this.i18n.t(s.labelKey) })),
  );

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
