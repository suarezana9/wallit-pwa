import { Component, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FieldTree, FormField, form, min, required, submit, validate } from '@angular/forms/signals';
import {
  AlertController, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonModal, IonSpinner,
  IonTitle, IonToolbar, ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, settingsOutline } from 'ionicons/icons';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import { CategoryMultiPickerComponent } from '../categories/category-multi-picker.component';
import type { Budget } from './budget.model';
import { BudgetsStore } from './budgets-store';

interface BudgetFormModel {
  name: string;
  limit: number | null;
  categories: string[];
}

import { AmountInputComponent } from '../shared/amount-input.component';
@Component({
  selector: 'app-budget-editor',
  templateUrl: 'budget-editor.component.html',
  styleUrls: ['budget-editor.component.scss'],
  imports: [
    AmountInputComponent, CategoryMultiPickerComponent, FormField, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput,
    IonModal, IonSpinner, IonTitle, IonToolbar, RouterLink, TranslatePipe,
  ],
})
export class BudgetEditorComponent {
  private readonly store = inject(BudgetsStore);
  private readonly i18n = inject(I18n);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  readonly preferences = inject(PreferencesStore);

  readonly changed = output<void>();

  readonly isOpen = signal(false);
  readonly editing = signal<Budget | null>(null);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly model = signal<BudgetFormModel>({ name: '', limit: null, categories: [] });
  readonly budgetForm = form(this.model, (path) => {
    required(path.name, { message: () => this.i18n.t('errBudgetName') });
    required(path.limit, { message: () => this.i18n.t('errBudgetLimit') });
    min(path.limit, 0.01, { message: () => this.i18n.t('errBudgetLimit') });
    validate(path.categories, ({ value }) =>
      value().length ? undefined : { kind: 'required', message: this.i18n.t('errBudgetCategories') },
    );
  });

  readonly title = computed(() => this.i18n.t(this.editing() ? 'editBudget' : 'newBudget'));

  constructor() {
    addIcons({ closeOutline, settingsOutline });
  }

  openNew(): void {
    this.editing.set(null);
    this.model.set({ name: '', limit: null, categories: [] });
    this.open();
  }

  openEdit(budget: Budget): void {
    this.editing.set(budget);
    this.model.set({ name: budget.name, limit: Number(budget.amount_limit), categories: [...budget.categories] });
    this.open();
  }

  close(): void {
    this.isOpen.set(false);
  }

  errorOf(field: FieldTree<unknown>): string {
    const state = field();
    if (!state.touched()) return '';
    return state.errors()[0]?.message ?? '';
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.budgetForm, async () => {
      const { name, limit, categories } = this.model();
      const input = { name, amount_limit: Number(limit), categories };
      this.saving.set(true);
      this.serverError.set(null);
      const editing = this.editing();
      const error = editing ? await this.store.update(editing.id, input) : await this.store.create(input);
      this.saving.set(false);
      if (error) {
        this.serverError.set(error);
        return;
      }
      this.close();
      this.changed.emit();
      await this.toast(this.i18n.t('budgetSaved'));
    });
  }

  async confirmRemove(budget: Budget): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('deleteBudgetConfirm', budget.name),
      message: this.i18n.t('deleteBudgetText'),
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        { text: this.i18n.t('delete'), role: 'destructive', handler: () => void this.remove(budget.id) },
      ],
    });
    await alert.present();
  }

  private open(): void {
    this.serverError.set(null);
    this.budgetForm().reset();
    this.isOpen.set(true);
  }

  private async remove(id: string): Promise<void> {
    const error = await this.store.remove(id);
    if (error) {
      await this.toast(error, 'danger');
      return;
    }
    this.close();
    this.changed.emit();
    await this.toast(this.i18n.t('budgetDeleted'));
  }

  private async toast(message: string, color: 'dark' | 'danger' = 'dark'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
