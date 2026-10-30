import { Component, computed, inject, input, linkedSignal, output, resource, signal, untracked } from '@angular/core';
import {
  FieldTree, FormField, form, hidden, maxLength, min, required, submit,
} from '@angular/forms/signals';
import {
  IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { attachOutline, closeOutline, expandOutline, receiptOutline } from 'ionicons/icons';
import { monthRange, toIsoDate } from '../core/dates';
import { MoneyPipe } from '../core/money';
import { Supabase } from '../core/supabase';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { PreferencesStore } from '../core/preferences-store';
import type { FuenteIngreso, MedioPago, Movimiento, TipoMovimiento } from '../core/database.types';
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
import { TicketAdjustComponent } from './ticket-adjust.component';
import { Detalle, fromTicket, netAmount, parseDetalle, toJson, withAmount } from './detalle.model';
import { CARD_CATEGORY, INCOME_SOURCES, MovementInput, PAYMENT_METHODS, typeInfo } from './movement.model';

export interface MovementFormModel {
  tipo: TipoMovimiento;
  amount: number | null;
  category: string;
  fuente: string;
  description: string;
  date: string;
  isPrivate: boolean;
  medioPago: string;
}

export function toFormModel(movement: Movimiento | null): MovementFormModel {
  if (!movement) {
    return {
      tipo: 'gasto', amount: null, category: '', fuente: '', description: '', date: toIsoDate(new Date()), isPrivate: false, medioPago: '',
    };
  }
  // El pago de tarjeta se edita como un gasto en "Tarjeta de crédito" (con "ya cargué las compras" marcado).
  const card = movement.tipo === 'pago_tarjeta';
  return {
    tipo: card ? 'gasto' : movement.tipo,
    amount: Number(movement.amount),
    category: card ? CARD_CATEGORY : movement.tipo === 'gasto' ? movement.category : '',
    fuente: movement.fuente ?? '',
    description: movement.description,
    date: movement.date,
    isPrivate: movement.is_private,
    medioPago: movement.medio_pago ?? '',
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
    medio_pago: model.tipo === 'gasto' && model.medioPago ? (model.medioPago as MedioPago) : null,
  };
}

/** Lo que se guarda para un gasto en "Tarjeta de crédito": si las compras ya están cargadas, es un pago que no suma. */
export function asCardPayment(input: MovementInput, purchasesLoaded: boolean): MovementInput {
  if (input.tipo !== 'gasto' || input.category !== CARD_CATEGORY || !purchasesLoaded) return input;
  return { ...input, tipo: 'pago_tarjeta', medio_pago: null, is_private: false, division: null, detalle: null };
}

@Component({
  selector: 'app-movement-form',
  templateUrl: 'movement-form.component.html',
  styleUrls: ['movement-form.component.scss'],
  host: { class: 'ion-page', '(document:keydown.escape)': 'viewingReceipt.set(false)' },
  imports: [
    AiAssistComponent, CategoryPickerComponent, ChipPickerComponent, FormField, GroupSplitComponent, IonButton, IonButtons,
    IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonSpinner, IonTitle, IonToolbar, MoneyPipe, TicketAdjustComponent, TranslatePipe,
    TypePickerComponent,
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
    ...this.groups.openList().map(({ group }) => ({ value: group.id, label: group.name })),
  ]);
  readonly showSpacePicker = computed(() => !this.isEdit() && this.groups.openList().length > 0);

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
  /** Bolsa común (false): los gastos arrancan sin dividir. Grupos que dividen: entre todos en partes iguales. */
  readonly splitsByDefault = computed(() => {
    const id = this.targetGroupId();
    return this.groups.list().find((g) => g.group.id === id)?.group.divide_gastos ?? true;
  });
  readonly division = linkedSignal<Division | null>(() => {
    const movement = this.movement();
    if (movement && movement.group_id === this.targetGroupId()) return movement.division;
    return this.splitsByDefault() ? defaultDivision(this.members().map((m) => m.userId)) : null;
  });
  readonly showSplit = computed(
    () => this.targetGroupId() !== null && this.model().tipo === 'gasto' && !this.isCardPayment() && this.members().length > 1,
  );
  readonly splitInvalid = computed(() => this.showSplit() && !divisionIsValid(Number(this.model().amount ?? 0), this.division()));

  /** Fecha sugerida para un movimiento nuevo (si estás viendo otro mes, el primer día de ese mes). */
  readonly defaultDate = input<string | null>(null);

  readonly model = linkedSignal(() => {
    const movement = this.movement();
    const defaultDate = this.defaultDate();
    const base = { ...toFormModel(movement), ...(!movement && defaultDate ? { date: defaultDate } : {}) };
    const first = this.prefill()?.movements[0];
    return first ? applyAiMovement(base, first, untracked(() => this.categoryNames())) : base;
  });

  // ---------- Tarjeta de crédito ----------

  readonly isCardCategory = computed(() => this.model().tipo === 'gasto' && this.model().category === CARD_CATEGORY);
  /** Respuesta a "¿Ya cargaste las compras?". null = sin responder (se sugiere según lo cargado con crédito). */
  readonly cardAnswer = linkedSignal<boolean | null>(() => {
    const movement = this.movement();
    return movement ? movement.tipo === 'pago_tarjeta' : null;
  });
  private readonly supabase = inject(Supabase).client;
  /** Lo que cargaste con crédito en los últimos dos meses: si hay, lo más probable es que el pago no deba sumar. */
  readonly creditSpent = resource({
    params: () => {
      if (!this.isCardCategory() || this.isEdit()) return undefined;
      return { groupId: this.targetGroupId(), userId: this.meId() };
    },
    loader: async ({ params }) => {
      const from = monthRange(-1).from;
      const base = this.supabase.from('expenses').select('amount').eq('tipo', 'gasto').eq('medio_pago', 'credito').gte('date', from);
      const { data } = await (params.groupId ? base.eq('group_id', params.groupId) : base.eq('user_id', params.userId).is('group_id', null));
      return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    },
  });
  readonly creditSpentValue = computed(() => (this.creditSpent.hasValue() ? this.creditSpent.value() : 0));
  readonly purchasesLoaded = computed(() => this.cardAnswer() ?? this.creditSpentValue() > 0);
  readonly isCardPayment = computed(() => this.isCardCategory() && this.purchasesLoaded());

  readonly paymentOptions = PAYMENT_METHODS;

  setPayment(id: MedioPago): void {
    this.model.update((m) => ({ ...m, medioPago: m.medioPago === id ? '' : id }));
  }

  /** Productos del ticket y reintegros (solo gastos). El monto del formulario es el neto. */
  private readonly detalle = linkedSignal<Detalle | null>(() => {
    const movement = this.movement();
    if (movement) return parseDetalle(movement.detalle);
    const first = this.prefill()?.movements[0];
    return first ? fromTicket(first.monto, first.items) : null;
  });
  /** El detalle siempre acompaña al monto: si se edita el monto a mano, el total del ticket se reacomoda. */
  readonly detalleView = computed(() => {
    const d = this.detalle();
    const amount = this.model().amount;
    return d && amount !== null && Number.isFinite(Number(amount)) ? withAmount(d, Number(amount)) : d;
  });

  onDetalle(next: Detalle | null): void {
    this.detalle.set(next);
    if (next) this.model.update((m) => ({ ...m, amount: netAmount(next) }));
  }

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
      const input = asCardPayment(
        {
          ...toMovementInput(this.model()),
          ...(this.isEdit() ? {} : { group_id: groupId }),
          paid_by: split && this.paidBy() !== this.meId() ? this.paidBy() : null,
          division: split ? this.division() : null,
          detalle: this.model().tipo === 'gasto' ? toJson(this.detalleView()) : null,
        },
        this.isCardCategory() && this.purchasesLoaded(),
      );
      this.save.emit({ input, receipt: this.receipt() });
    });
  }

  applyAi(result: AiResult): void {
    if (result.movements.length > 1) {
      this.multiple.emit(result);
      return;
    }
    this.model.update((m) => applyAiMovement(m, result.movements[0], this.categoryNames()));
    this.detalle.set(fromTicket(result.movements[0].monto, result.movements[0].items));
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
