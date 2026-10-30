import { Component, computed, inject, input, linkedSignal, output, resource, signal, untracked } from '@angular/core';
import {
  FieldTree, FormField, form, hidden, maxLength, min, required, submit,
} from '@angular/forms/signals';
import {
  IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { attachOutline, closeOutline, expandOutline, receiptOutline } from 'ionicons/icons';
import { toIsoDate } from '../core/dates';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import type { FuenteIngreso, Movimiento, TipoMovimiento } from '../core/database.types';
import { AiAssistComponent, AiSummary } from '../ai/ai-assist.component';
import { AiResult, applyAiMovement } from '../ai/ai.model';
import { imageToJpegDataUrl } from '../ai/media';
import { CategoriesStore } from '../categories/categories-store';
import { MovementSave, ReceiptDraft, draftFor } from '../receipts/receipt.model';
import { AuthStore } from '../core/auth-store';
import type { Division } from '../core/database.types';
import { defaultDivision, divisionIsValid } from '../groups/balances.model';
import { GroupSplitComponent } from '../groups/group-split.component';
import { GroupsStore, PERSONAL } from '../groups/groups-store';
import { ReceiptsService } from '../receipts/receipts.service';
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
  isPrivate: boolean;
}

export function toFormModel(movement: Movimiento | null): MovementFormModel {
  if (!movement) {
    return { tipo: 'gasto', amount: null, category: '', fuente: '', description: '', date: toIsoDate(new Date()), isPrivate: false };
  }
  return {
    tipo: movement.tipo,
    amount: Number(movement.amount),
    category: movement.tipo === 'gasto' ? movement.category : '',
    fuente: movement.fuente ?? '',
    description: movement.description,
    date: movement.date,
    isPrivate: movement.is_private,
  };
}

function summaryOf(result: AiResult): AiSummary {
  return { transcript: result.transcript, missingAmount: result.movements[0]?.monto === null };
}

export function toMovementInput(model: MovementFormModel): MovementInput {
  return {
    tipo: model.tipo,
    amount: Number(model.amount),
    category: model.tipo === 'gasto' ? model.category : 'Otros',
    fuente: model.tipo === 'ingreso' ? (model.fuente as FuenteIngreso) : null,
    description: model.description.trim(),
    date: model.date,
    is_private: model.tipo === 'gasto' && model.isPrivate,
  };
}

@Component({
  selector: 'app-movement-form',
  templateUrl: 'movement-form.component.html',
  styleUrls: ['movement-form.component.scss'],
  host: { class: 'ion-page', '(document:keydown.escape)': 'viewingReceipt.set(false)' },
  imports: [
    AiAssistComponent, CategoryPickerComponent, ChipPickerComponent, FormField, GroupSplitComponent, IonButton, IonButtons,
    IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonSpinner, IonTitle, IonToolbar, TranslatePipe, TypePickerComponent,
  ],
})
export class MovementFormComponent {
  private readonly i18n = inject(I18n);
  readonly preferences = inject(PreferencesStore);
  private readonly categories = inject(CategoriesStore);

  readonly movement = input<Movimiento | null>(null);
  readonly saving = input(false);
  readonly prefill = input<AiResult | null>(null);

  readonly save = output<MovementSave>();
  readonly remove = output<string>();
  readonly dismiss = output<void>();
  /** La IA encontró varios movimientos: el editor cambia a la revisión en lote. */
  readonly multiple = output<AiResult>();

  private readonly receipts = inject(ReceiptsService);
  private readonly auth = inject(AuthStore);
  private readonly groups = inject(GroupsStore);

  readonly meId = computed(() => this.auth.user()?.id ?? '');

  /** Dónde se guarda: arranca en el espacio activo y se puede cambiar (solo al crear). */
  readonly spaceId = linkedSignal(() => {
    const movement = this.movement();
    return movement ? (movement.group_id ?? PERSONAL) : untracked(() => this.groups.contextId());
  });
  readonly targetGroupId = computed(() => (this.spaceId() === PERSONAL ? null : this.spaceId()));
  readonly spaceOptions = computed<ChipOption[]>(() => [
    { value: PERSONAL, label: this.i18n.t('personal') },
    ...this.groups.list().map(({ group }) => ({ value: group.id, label: group.name })),
  ]);
  readonly showSpacePicker = computed(() => !this.isEdit() && this.groups.list().length > 0);

  private readonly membersResource = resource({
    params: () => this.targetGroupId() ?? undefined,
    loader: ({ params }) => this.groups.fetchMembers(params),
  });
  readonly members = computed(() => (this.membersResource.hasValue() ? this.membersResource.value() : []));

  readonly paidBy = linkedSignal(() => {
    this.targetGroupId();
    const movement = this.movement();
    return movement ? (movement.paid_by ?? movement.user_id) : this.meId();
  });
  readonly division = linkedSignal<Division | null>(() => {
    const movement = this.movement();
    if (movement && movement.group_id === this.targetGroupId()) return movement.division;
    return defaultDivision(this.members().map((m) => m.userId));
  });
  readonly showSplit = computed(() => this.targetGroupId() !== null && this.model().tipo === 'gasto' && this.members().length > 1);
  readonly splitInvalid = computed(() => this.showSplit() && !divisionIsValid(Number(this.model().amount ?? 0), this.division()));

  readonly model = linkedSignal(() => {
    const base = toFormModel(this.movement());
    const first = this.prefill()?.movements[0];
    return first ? applyAiMovement(base, first, untracked(() => this.categoryNames())) : base;
  });

  readonly receipt = linkedSignal<ReceiptDraft>(() => {
    const prefill = this.prefill()?.receipt;
    return prefill ? { kind: 'new', dataUrl: prefill } : draftFor(this.movement()?.receipt_url);
  });

  private readonly storedReceipt = resource({
    params: () => {
      const draft = this.receipt();
      return draft?.kind === 'stored' ? draft.ref : undefined;
    },
    loader: ({ params }) => this.receipts.url(params),
  });

  readonly receiptSrc = computed(() => {
    const draft = this.receipt();
    if (draft?.kind === 'new') return draft.dataUrl;
    return draft && this.storedReceipt.hasValue() ? this.storedReceipt.value() : null;
  });
  readonly receiptIsNew = computed(() => this.receipt()?.kind === 'new');
  readonly receiptLoading = computed(() => this.receipt()?.kind === 'stored' && this.storedReceipt.isLoading());
  readonly viewingReceipt = signal(false);

  readonly aiSummary = linkedSignal<AiSummary | null>(() => {
    const prefill = this.prefill();
    return prefill?.movements.length ? summaryOf(prefill) : null;
  });

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
    addIcons({ attachOutline, closeOutline, expandOutline, receiptOutline });
  }

  errorOf(field: FieldTree<unknown>): string {
    const state = field();
    if (!state.touched()) return '';
    return state.errors()[0]?.message ?? '';
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.splitInvalid()) return;
    await submit(this.movementForm, async () => {
      const groupId = this.targetGroupId();
      const split = this.showSplit();
      const input = {
        ...toMovementInput(this.model()),
        ...(this.isEdit() ? {} : { group_id: groupId }),
        paid_by: split && this.paidBy() !== this.meId() ? this.paidBy() : null,
        division: split ? this.division() : null,
      };
      this.save.emit({ input, receipt: this.receipt() });
    });
  }

  applyAi(result: AiResult): void {
    if (result.movements.length > 1) {
      this.multiple.emit(result);
      return;
    }
    this.model.update((m) => applyAiMovement(m, result.movements[0], this.categoryNames()));
    this.aiSummary.set(summaryOf(result));
    if (result.receipt) this.receipt.set({ kind: 'new', dataUrl: result.receipt });
  }

  async attachReceipt(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.receipt.set({ kind: 'new', dataUrl: await imageToJpegDataUrl(file) });
    } catch {
      // Formato que el navegador no puede leer (por ejemplo HEIC en Windows): se queda el comprobante anterior.
    }
  }

  removeReceipt(): void {
    this.viewingReceipt.set(false);
    this.receipt.set(null);
  }

  private categoryNames(): string[] {
    return this.categories.visible().map((c) => c.name);
  }

  onRemove(): void {
    const movement = this.movement();
    if (movement) this.remove.emit(movement.id);
  }
}
