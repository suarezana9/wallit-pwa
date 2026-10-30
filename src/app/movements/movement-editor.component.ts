import { Component, inject, output, signal } from '@angular/core';
import { AlertController, IonModal, ToastController } from '@ionic/angular';
import type { Movimiento } from '../core/database.types';
import { AuthStore } from '../core/auth-store';
import { I18n } from '../core/i18n/i18n';
import { GroupsStore } from '../groups/groups-store';
import type { AiResult } from '../ai/ai.model';
import { MovementSave, receiptPlan } from '../receipts/receipt.model';
import { defaultDivision } from '../groups/balances.model';
import { ReceiptsService } from '../receipts/receipts.service';
import { BulkReviewComponent } from './bulk-review.component';
import { MovementFormComponent } from './movement-form.component';
import { MovementInput } from './movement.model';
import { MovementsStore } from './movements-store';

@Component({
  selector: 'app-movement-editor',
  imports: [BulkReviewComponent, IonModal, MovementFormComponent],
  template: `
    <ion-modal class="wl-dialog" [isOpen]="isOpen()" (didDismiss)="close()">
      <ng-template>
        <app-movement-form
          [movement]="editing()"
          [saving]="saving()"
          [prefill]="prefill()"
          (save)="save($event)"
          (remove)="confirmRemove($event)"
          (multiple)="openBulk($event)"
          (dismiss)="close()"
        />
      </ng-template>
    </ion-modal>

    <ion-modal class="wl-dialog" [isOpen]="bulk() !== null" (didDismiss)="bulk.set(null)">
      <ng-template>
        <app-bulk-review [result]="bulk()" [saving]="saving()" (save)="saveMany($event)" (dismiss)="bulk.set(null)" />
      </ng-template>
    </ion-modal>
  `,
})
export class MovementEditorComponent {
  private readonly store = inject(MovementsStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly i18n = inject(I18n);
  private readonly auth = inject(AuthStore);
  readonly groups = inject(GroupsStore);
  private readonly receipts = inject(ReceiptsService);

  readonly changed = output<void>();

  readonly isOpen = signal(false);
  readonly editing = signal<Movimiento | null>(null);
  readonly prefill = signal<AiResult | null>(null);
  readonly saving = signal(false);
  /** Resultado de la IA con varios movimientos, en revisión. */
  readonly bulk = signal<AiResult | null>(null);

  openNew(prefill: AiResult | null = null): void {
    if (prefill && prefill.movements.length > 1) {
      this.openBulk(prefill);
      return;
    }
    this.prefill.set(prefill);
    this.editing.set(null);
    this.isOpen.set(true);
  }

  openEdit(movement: Movimiento): void {
    if (!this.isMine(movement)) {
      void this.toast(this.i18n.t('onlyAuthorEdits'));
      return;
    }
    this.prefill.set(null);
    this.editing.set(movement);
    this.isOpen.set(true);
  }

  isMine(movement: Movimiento): boolean {
    return movement.user_id === this.auth.user()?.id;
  }

  close(): void {
    this.isOpen.set(false);
  }

  openBulk(result: AiResult): void {
    this.close();
    this.bulk.set(result);
  }

  /**
   * Orden: primero se sube la foto (si hay una nueva), después se guarda el movimiento con su ruta
   * y recién ahí se borra la foto vieja. Si falla el guardado, se borra la foto recién subida.
   */
  async save({ input, receipt }: MovementSave): Promise<void> {
    this.saving.set(true);
    const editing = this.editing();
    const plan = receiptPlan(editing?.receipt_url ?? null, receipt);
    let receiptUrl = plan.keep;
    if (plan.upload) {
      receiptUrl = await this.receipts.upload(plan.upload).catch(() => null);
      if (!receiptUrl) {
        this.saving.set(false);
        await this.toast(this.i18n.t('errReceiptUpload'), 'danger');
        return;
      }
    }
    const row = { ...input, receipt_url: receiptUrl };
    const error = editing ? await this.store.update(editing.id, row) : await this.store.create(row);
    this.saving.set(false);
    if (error) {
      if (plan.upload) void this.receipts.remove(receiptUrl);
      await this.toast(error, 'danger');
      return;
    }
    void this.receipts.remove(plan.discard);
    this.close();
    this.changed.emit();
    await this.toast(editing ? this.i18n.t('changesSaved') : this.savedMessage(input.group_id));
  }

  /** Si se guardó en otro espacio que el activo, se avisa dónde quedó (si no, parece que desapareció). */
  private savedMessage(groupId: string | null | undefined): string {
    if (groupId === undefined || groupId === this.groups.activeGroupId()) return this.i18n.t('saved');
    const name = groupId ? this.groups.list().find((g) => g.group.id === groupId)?.group.name : this.i18n.t('personal');
    return this.i18n.t('savedIn', name ?? '');
  }

  async saveMany(inputs: MovementInput[]): Promise<void> {
    this.saving.set(true);
    // En un grupo, los gastos de la carga en lote se dividen en partes iguales entre todos.
    const memberIds = this.groups.activeMembers.hasValue() ? this.groups.activeMembers.value().map((m) => m.userId) : [];
    const division = this.groups.activeGroupId() ? defaultDivision(memberIds) : null;
    const rows = inputs.map((input) => (input.tipo === 'gasto' ? { ...input, division } : input));
    const error = await this.store.createMany(rows);
    this.saving.set(false);
    if (error) {
      await this.toast(error, 'danger');
      return;
    }
    this.bulk.set(null);
    this.changed.emit();
    await this.toast(this.i18n.t('savedMany', String(inputs.length)));
  }

  async confirmRemove(id: string): Promise<void> {
    const alert = await this.alerts.create({
      header: this.i18n.t('deleteConfirm'),
      message: this.i18n.t('cannotUndo'),
      buttons: [
        { text: this.i18n.t('cancel'), role: 'cancel' },
        { text: this.i18n.t('delete'), role: 'destructive', handler: () => this.remove(id) },
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
    this.changed.emit();
    await this.toast(this.i18n.t('deleted'));
  }

  private async toast(message: string, color: 'dark' | 'danger' = 'dark'): Promise<void> {
    const toast = await this.toasts.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
