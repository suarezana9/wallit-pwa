import { Component, computed, inject, input, model } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, checkmarkCircle, peopleOutline } from 'ionicons/icons';
import type { Division } from '../core/database.types';
import { I18n, TranslatePipe } from '../core/i18n/i18n';
import { MoneyPipe } from '../core/money';
import { PreferencesStore } from '../core/preferences-store';
import { MEMBER_COLORS } from '../movements/explorer/movement-explorer.component';
import { defaultDivision, divisionGap, divisionIsValid, equalShares } from './balances.model';
import type { GroupMember } from './groups-store';

/** "¿Quién pagó?" y "¿Entre quiénes se divide?" para un gasto de grupo. */
@Component({
  selector: 'app-group-split',
  imports: [IonIcon, MoneyPipe, TranslatePipe],
  template: `
    <div class="wl-field">
      <span class="wl-field-label">{{ 'paidBy' | t }}</span>
      <div class="chips" role="radiogroup" [attr.aria-label]="'paidBy' | t">
        @for (member of people(); track member.userId) {
          <button
            type="button"
            role="radio"
            class="chip"
            [class.selected]="paidBy() === member.userId"
            [attr.aria-checked]="paidBy() === member.userId"
            (click)="paidBy.set(member.userId)"
          >
            <span class="dot" [style.background]="member.color" aria-hidden="true">{{ member.initial }}</span>
            {{ member.label }}
          </button>
        }
      </div>
    </div>

    <div class="wl-field">
      <div class="split-head">
        <span class="wl-field-label">{{ 'splitBetween' | t }}</span>
        @if (division()) {
          <div class="modes" role="radiogroup" [attr.aria-label]="'splitBetween' | t">
            <button type="button" role="radio" [class.selected]="mode() === 'iguales'" [attr.aria-checked]="mode() === 'iguales'" (click)="setMode('iguales')">
              {{ 'splitEqual' | t }}
            </button>
            <button type="button" role="radio" [class.selected]="mode() === 'montos'" [attr.aria-checked]="mode() === 'montos'" (click)="setMode('montos')">
              {{ 'splitAmounts' | t }}
            </button>
          </div>
        }
      </div>

      @if (!division()) {
        <button type="button" class="enable" (click)="division.set(defaults())">
          <ion-icon name="people-outline" aria-hidden="true" />
          {{ 'splitEnable' | t }}
        </button>
      } @else {
        <ul class="people">
          @for (member of people(); track member.userId) {
            <li [class.off]="mode() === 'iguales' && !included(member.userId)">
              @if (mode() === 'iguales') {
                <label class="row">
                  <input type="checkbox" [checked]="included(member.userId)" (change)="toggle(member.userId)" />
                  <span class="dot" [style.background]="member.color" aria-hidden="true">{{ member.initial }}</span>
                  <span class="name">{{ member.label }}</span>
                  <span class="share">{{ included(member.userId) ? (equal()[member.userId] ?? 0 | money) : '—' }}</span>
                </label>
              } @else {
                <div class="row">
                  <span class="dot" [style.background]="member.color" aria-hidden="true">{{ member.initial }}</span>
                  <span class="name">{{ member.label }}</span>
                  <span class="amount-input">
                    <span aria-hidden="true">{{ preferences.currencyInfo().symbol }}</span>
                    <input
                      type="number"
                      inputmode="decimal"
                      min="0"
                      step="any"
                      class="wl-no-spin"
                      placeholder="0"
                      [attr.aria-label]="'splitAmountFor' | t: member.label"
                      [value]="part(member.userId) ?? ''"
                      (input)="setPart(member.userId, $any($event.target).value)"
                    />
                  </span>
                </div>
              }
            </li>
          }
        </ul>
        <p class="status" [class.ok]="valid()" role="status">
          <ion-icon [name]="valid() ? 'checkmark-circle' : 'alert-circle'" aria-hidden="true" />
          {{ statusText() }}
        </p>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 20px; padding: 16px; border-radius: 16px; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px 5px 5px; border-radius: 999px;
      font: inherit; font-size: 14px; font-weight: 600; color: var(--wl-muted); cursor: pointer;
      background: var(--ion-background-color, #fff); border: 1px solid var(--wl-field-border);
    }
    .chip.selected { color: var(--ion-color-primary); border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.08); }
    .dot { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; color: #fff; }
    .split-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .modes { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--ion-background-color, #fff); border: 1px solid var(--wl-field-border); }
    .modes button { padding: 5px 10px; border: 0; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 600; color: var(--wl-muted); background: none; cursor: pointer; }
    .modes button.selected { color: #fff; background: var(--ion-color-primary); }
    .enable {
      display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; padding: 8px 14px; border-radius: 10px;
      font: inherit; font-size: 14px; font-weight: 600; color: var(--ion-color-primary); cursor: pointer;
      background: rgba(var(--ion-color-primary-rgb), 0.08); border: 0;
    }
    .people { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .people li.off { opacity: 0.5; }
    .row { display: flex; align-items: center; gap: 10px; min-height: 40px; cursor: pointer; }
    .row input[type='checkbox'] { width: 18px; height: 18px; accent-color: var(--ion-color-primary); }
    .name { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .share { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .amount-input {
      display: flex; align-items: center; gap: 4px; width: 130px; height: 38px; padding: 0 10px; border-radius: 10px;
      background: var(--ion-background-color, #fff); border: 1px solid var(--wl-field-border); font-weight: 600;
    }
    .amount-input:focus-within { border-color: var(--ion-color-primary); }
    .amount-input input { width: 100%; min-width: 0; border: 0; outline: none; background: none; font: inherit; color: inherit; text-align: right; }
    .status { display: flex; align-items: center; gap: 6px; margin: 4px 0 0; font-size: 13px; font-weight: 600; color: var(--ion-color-danger); }
    .status.ok { color: var(--wl-type-ingreso); }
  `,
})
export class GroupSplitComponent {
  readonly members = input<readonly GroupMember[]>([]);
  readonly amount = input<number | null>(null);
  readonly meId = input('');
  readonly paidBy = model.required<string>();
  readonly division = model.required<Division | null>();

  private readonly i18n = inject(I18n);
  readonly preferences = inject(PreferencesStore);

  readonly people = computed(() => {
    const me = this.meId();
    const sorted = [...this.members()].sort((a, b) => (a.userId === me ? -1 : b.userId === me ? 1 : 0));
    return sorted.map((m) => ({
      userId: m.userId,
      label: m.userId === me ? this.i18n.t('youCap') : m.name,
      initial: m.name.charAt(0).toUpperCase(),
      color: MEMBER_COLORS[this.members().indexOf(m) % MEMBER_COLORS.length],
    }));
  });

  readonly mode = computed(() => this.division()?.tipo ?? 'iguales');
  readonly defaults = computed(() => defaultDivision(this.members().map((m) => m.userId)));

  readonly equal = computed(() => {
    const division = this.division();
    return division?.tipo === 'iguales' ? equalShares(this.amount() ?? 0, division.entre) : {};
  });

  readonly gap = computed(() => divisionGap(this.amount() ?? 0, this.division()));
  readonly valid = computed(() => divisionIsValid(this.amount() ?? 0, this.division()));

  readonly statusText = computed(() => {
    const division = this.division();
    if (division?.tipo === 'iguales') {
      return division.entre.length ? this.i18n.t('splitEqualOk', String(division.entre.length)) : this.i18n.t('splitPickSomeone');
    }
    const gap = this.gap();
    if (gap === 0) return this.i18n.t('splitAmountsOk');
    const money = Math.abs(gap).toLocaleString(this.preferences.locale(), { maximumFractionDigits: 2 });
    return this.i18n.t(gap > 0 ? 'splitMissing' : 'splitOver', `${this.preferences.currencyInfo().symbol}${money}`);
  });

  constructor() {
    addIcons({ alertCircle, checkmarkCircle, peopleOutline });
  }

  included(userId: string): boolean {
    const division = this.division();
    return division?.tipo === 'iguales' && division.entre.includes(userId);
  }

  part(userId: string): number | null {
    const division = this.division();
    return division?.tipo === 'montos' ? (division.partes[userId] ?? null) : null;
  }

  toggle(userId: string): void {
    const division = this.division();
    if (division?.tipo !== 'iguales') return;
    const entre = division.entre.includes(userId) ? division.entre.filter((id) => id !== userId) : [...division.entre, userId];
    this.division.set({ tipo: 'iguales', entre });
  }

  /** Al pasar a "montos" se arranca con el reparto en partes iguales, para que solo haya que retocar. */
  setMode(mode: 'iguales' | 'montos'): void {
    const division = this.division();
    if (!division) return;
    if (mode === 'montos' && division.tipo === 'iguales') {
      this.division.set({ tipo: 'montos', partes: equalShares(this.amount() ?? 0, division.entre) });
    } else if (mode === 'iguales' && division.tipo === 'montos') {
      const entre = Object.entries(division.partes).filter(([, v]) => v > 0).map(([id]) => id);
      this.division.set({ tipo: 'iguales', entre: entre.length ? entre : this.members().map((m) => m.userId) });
    }
  }

  setPart(userId: string, value: string): void {
    const division = this.division();
    if (division?.tipo !== 'montos') return;
    const amount = Number(value);
    const partes = { ...division.partes };
    if (value === '' || !Number.isFinite(amount) || amount <= 0) delete partes[userId];
    else partes[userId] = Math.round(amount * 100) / 100;
    this.division.set({ tipo: 'montos', partes });
  }
}
