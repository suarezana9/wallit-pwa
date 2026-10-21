import { Component, inject, signal } from '@angular/core';
import { AlertController, IonModal, ToastController } from '@ionic/angular';
import type { Movimiento } from '../core/database.types';
import { MovementFormComponent } from './movement-form.component';
import { MovementInput } from './movement.model';
import { MovementsStore } from './movements-store';

@Component({
  selector: 'app-movement-editor',
  imports: [IonModal, MovementFormComponent],
  template: `
    <ion-modal class="wl-dialog" [isOpen]="isOpen()" (didDismiss)="close()">
      <ng-template>
        <app-movement-form
          [movement]="editing()"
          [saving]="saving()"
          (save)="save($event)"
          (remove)="confirmRemove($event)"
          (dismiss)="close()"
        />
      </ng-template>
    </ion-modal>
  `,
})
export class MovementEditorComponent {
  private readonly store = inject(MovementsStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly isOpen = signal(false);
  readonly editing = signal<Movimiento | null>(null);
  readonly saving = signal(false);

  openNew(): void {
    this.editing.set(null);
    this.isOpen.set(true);
  }

  openEdit(movement: Movimiento): void {
    this.editing.set(movement);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  async save(input: MovementInput): Promise<void> {
    this.saving.set(true);
    const editing = this.editing();
    const error = editing ? await this.store.update(editing.id, input) : await this.store.create(input);
    this.saving.set(false);
    if (error) {
      await this.toast(error, 'danger');
      return;
    }
    this.close();
    await this.toast(editing ? 'Cambios guardados' : 'Movimiento guardado');
  }

  async confirmRemove(id: string): Promise<void> {
    const alert = await this.alerts.create({
      header: '¿Eliminar movimiento?',
      message: 'No se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.remove(id) },
      ],
    });
    await alert.present();
  }

  private async remove(id: string): Promise<void> {
    const error = await this.store.remove(id);
    if (error) {
      await this.toast(error, 'danger');
      return;
    }
    this.close();
    await this.toast('Movimiento eliminado');
  }

  private async toast(message: string, color: 'dark' | 'danger' = 'dark'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
