import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, chevronDown, chevronUp, closeCircle, receiptOutline } from 'ionicons/icons';
import { TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { AmountInputComponent } from '../shared/amount-input.component';
import { Detalle, excludedTotal, hasAdjustments, netAmount } from './detalle.model';

/**
 * Ajustes de un gasto: sacar productos del ticket que no eran tuyos y descontar reintegros (MODO, Cuenta DNI…).
 * El monto del gasto pasa a ser lo que realmente gastaste; el detalle queda guardado para revisarlo después.
 */
@Component({
  selector: 'app-ticket-adjust',
  imports: [AmountInputComponent, IonIcon, MoneyPipe, TranslatePipe],
  template: `
    @if (detalle()?.items?.length) {
      <div class="items-box">
        <button type="button" class="toggle" [attr.aria-expanded]="open()" (click)="open.set(!open())">
          <ion-icon name="receipt-outline" aria-hidden="true" />
          <span class="toggle-text">
            <strong>{{ 'ticketItems' | t: String(detalle()!.items.length) }}</strong>
            <span>{{ excludedCount() ? ('ticketExcluded' | t: String(excludedCount())) : ('ticketUncheckHint' | t) }}</span>
          </span>
          <ion-icon [name]="open() ? 'chevron-up' : 'chevron-down'" aria-hidden="true" />
        </button>
        @if (open()) {
          <ul>
            @for (item of detalle()!.items; track $index) {
              <li>
                <label [class.off]="item.excluido">
                  <input type="checkbox" [checked]="!item.excluido" (change)="toggle($index)" />
                  <span class="desc">{{ item.descripcion }}</span>
                  <span class="amount">{{ item.monto | money }}</span>
                </label>
              </li>
            }
          </ul>
        }
      </div>
    }

    @if (showRefund()) {
      <div class="refund">
        <span class="wl-field-label">{{ 'refundTitle' | t }}</span>
        <div class="refund-row">
          <label class="money-input">
            <span aria-hidden="true">−</span>
            <app-amount-input
              class="refund-input"
              [label]="'refundAmount' | t"
              [value]="detalle()?.reintegro || null"
              (valueChange)="setRefund($event)"
            />
          </label>
          <input
            class="note"
            type="text"
            maxlength="40"
            [placeholder]="'refundNotePlaceholder' | t"
            [attr.aria-label]="'refundNote' | t"
            [value]="detalle()?.reintegro_nota ?? ''"
            (input)="setNote($any($event.target).value)"
          />
          <button type="button" class="remove" (click)="removeRefund()" [attr.aria-label]="'receiptRemove' | t">
            <ion-icon name="close-circle" />
          </button>
        </div>
      </div>
    } @else {
      <button type="button" class="add-refund" (click)="showRefund.set(true)">
        <ion-icon name="add" aria-hidden="true" />
        {{ 'refundAdd' | t }}
      </button>
    }

    @if (adjusted(); as d) {
      <p class="breakdown">
        {{ 'ticketTotal' | t }} {{ d.total | money }}
        @if (excluded() > 0) {
          <span> − {{ 'notMine' | t }} {{ excluded() | money }}</span>
        }
        @if (d.reintegro > 0) {
          <span> − {{ d.reintegro_nota || ('refundShort' | t) }} {{ d.reintegro | money }}</span>
        }
        = <strong>{{ net() | money }}</strong>
      </p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; }
    .items-box { border-radius: 14px; border: 1px solid var(--wl-field-border); background: var(--wl-field-bg); overflow: hidden; }
    .toggle {
      display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: 0; background: none;
      font: inherit; text-align: left; color: inherit; cursor: pointer;
    }
    .toggle > ion-icon { flex: none; font-size: 18px; color: var(--wl-muted); }
    .toggle-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .toggle-text strong { font-size: 14px; }
    .toggle-text span { font-size: 12px; color: var(--wl-muted); }
    ul { list-style: none; margin: 0; padding: 0 12px 8px; max-height: 260px; overflow-y: auto; }
    li label { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--wl-field-border); cursor: pointer; font-size: 14px; }
    li input { flex: none; width: 18px; height: 18px; accent-color: var(--ion-color-primary); }
    .desc { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .amount { flex: none; font-variant-numeric: tabular-nums; font-weight: 600; }
    label.off .desc, label.off .amount { text-decoration: line-through; color: var(--wl-muted); }
    .add-refund {
      display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; padding: 4px 0; border: 0; background: none;
      font: inherit; font-size: 14px; font-weight: 600; color: var(--ion-color-primary); cursor: pointer;
    }
    .refund { display: flex; flex-direction: column; gap: 6px; }
    .refund-row { display: flex; align-items: center; gap: 8px; }
    .money-input, .note {
      height: 44px; border-radius: 12px; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
      font: inherit; color: inherit;
    }
    .money-input { flex: none; width: 130px; display: flex; align-items: center; gap: 4px; padding: 0 10px; font-weight: 700; color: var(--wl-type-ingreso); }
    .refund-input { flex: 1; min-width: 0; }
    .note { flex: 1; min-width: 0; padding: 0 12px; outline: none; }
    .money-input:focus-within, .note:focus { border-color: var(--ion-color-primary); }
    .remove { flex: none; display: grid; place-items: center; padding: 0; border: 0; background: none; font-size: 20px; color: var(--wl-muted); cursor: pointer; }
    .breakdown { margin: 0; padding: 10px 12px; border-radius: 12px; font-size: 13px; color: var(--wl-muted); background: rgba(var(--ion-color-primary-rgb), 0.06); }
    .breakdown strong { color: var(--ion-text-color); }
  `,
})
export class TicketAdjustComponent {
  readonly detalle = input<Detalle | null>(null);
  /** Monto actual del formulario: si no hay ticket, el reintegro se descuenta de acá. */
  readonly amount = input<number | null>(null);
  readonly changed = output<Detalle | null>();

  readonly String = String;
  readonly open = linkedSignal(() => false);
  readonly showRefund = linkedSignal(() => (this.detalle()?.reintegro ?? 0) > 0);

  readonly excludedCount = computed(() => this.detalle()?.items.filter((i) => i.excluido).length ?? 0);
  readonly excluded = computed(() => {
    const d = this.detalle();
    return d ? excludedTotal(d) : 0;
  });
  readonly adjusted = computed(() => {
    const d = this.detalle();
    return d && hasAdjustments(d) ? d : null;
  });
  readonly net = computed(() => {
    const d = this.detalle();
    return d ? netAmount(d) : 0;
  });

  constructor() {
    addIcons({ add, chevronDown, chevronUp, closeCircle, receiptOutline });
  }

  toggle(index: number): void {
    const d = this.detalle();
    if (!d) return;
    this.changed.emit({ ...d, items: d.items.map((item, i) => (i === index ? { ...item, excluido: !item.excluido } : item)) });
  }

  setRefund(value: number | null): void {
    const refund = value === null || value < 0 ? 0 : value;
    this.changed.emit({ ...this.base(), reintegro: refund });
  }

  setNote(value: string): void {
    this.changed.emit({ ...this.base(), reintegro_nota: value });
  }

  removeRefund(): void {
    this.showRefund.set(false);
    const d = this.detalle();
    if (!d) return;
    // Sin productos ni reintegro, el detalle ya no aporta nada.
    this.changed.emit(d.items.length ? { ...d, reintegro: 0, reintegro_nota: '' } : null);
  }

  /** Si no venía de un ticket, el total es el monto que ya estaba cargado (antes del reintegro). */
  private base(): Detalle {
    return this.detalle() ?? { total: this.amount() ?? 0, items: [], reintegro: 0, reintegro_nota: '' };
  }
}
