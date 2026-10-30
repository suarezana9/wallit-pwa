import { Component, computed, inject, input, linkedSignal, model, untracked } from '@angular/core';
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

/**
 * "¿Quién pagó?" y "Dividir este gasto" para un gasto de grupo. La división se muestra resumida
 * ("Partes iguales entre todos · $X c/u") y solo se abre el detalle si querés cambiarla.
 */
@Component({
  selector: 'app-group-split',
  imports: [IonIcon, MoneyPipe, TranslatePipe],
  template: `
    <div class="paid">
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

    <div class="split" [class.on]="!!division()">
      <button type="button" class="switch-row" role="switch" [attr.aria-checked]="!!division()" (click)="toggleSplit()">
        <ion-icon name="people-outline" class="lead" aria-hidden="true" />
        <span class="switch-text">
          <strong>{{ 'splitEnable' | t }}</strong>
          <span>{{ switchHint() }}</span>
        </span>
        <span class="switch" aria-hidden="true"><span></span></span>
      </button>

      @if (division()) {
        <button type="button" class="summary" [attr.aria-expanded]="editing()" (click)="editing.set(!editing())">
          <span class="faces" aria-hidden="true">
            @for (member of includedPeople(); track member.userId) {
              <span class="dot" [style.background]="member.color">{{ member.initial }}</span>
            }
          </span>
          <span class="summary-text" [class.bad]="!valid()">{{ summaryText() }}</span>
          <span class="edit">{{ (editing() ? 'splitDone' : 'edit') | t }}</span>
        </button>

        @if (editing()) {
          <div class="editor">
            <div class="modes" role="radiogroup" [attr.aria-label]="'splitBetween' | t">
              <button type="button" role="radio" [class.selected]="mode() === 'iguales'" [attr.aria-checked]="mode() === 'iguales'" (click)="setMode('iguales')">
                {{ 'splitEqual' | t }}
              </button>
              <button type="button" role="radio" [class.selected]="mode() === 'montos'" [attr.aria-checked]="mode() === 'montos'" (click)="setMode('montos')">
                {{ 'splitAmounts' | t }}
              </button>
            </div>
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
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; padding: 14px; border-radius: 16px; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border); }
    .paid { display: flex; flex-direction: column; gap: 8px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; border-radius: 999px;
      font: inherit; font-size: 14px; font-weight: 600; color: var(--wl-muted); cursor: pointer;
      background: var(--ion-background-color, #fff); border: 1px solid var(--wl-field-border);
    }
    .chip.selected { color: var(--ion-color-primary); border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.08); }
    .dot { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 700; color: #fff; }
    .split { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px solid var(--wl-field-border); }
    .switch-row {
      display: flex; align-items: center; gap: 12px; width: 100%; padding: 0; border: 0; background: none;
      font: inherit; text-align: left; color: inherit; cursor: pointer;
    }
    .lead { flex: none; font-size: 20px; color: var(--wl-muted); }
    .on .lead { color: var(--ion-color-primary); }
    .switch-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .switch-text strong { font-size: 14px; }
    .switch-text span { font-size: 12px; line-height: 1.35; color: var(--wl-muted); }
    .switch { flex: none; position: relative; width: 42px; height: 24px; border-radius: 999px; background: var(--wl-field-border); transition: background 0.15s ease; }
    .switch span { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform 0.15s ease; }
    .on .switch { background: var(--ion-color-primary); }
    .on .switch span { transform: translateX(18px); }
    .summary {
      display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 12px;
      font: inherit; text-align: left; color: inherit; cursor: pointer;
      background: var(--ion-background-color, #fff); border: 1px solid var(--wl-field-border);
    }
    .faces { flex: none; display: flex; }
    .faces .dot { width: 24px; height: 24px; font-size: 11px; border: 2px solid var(--ion-background-color, #fff); }
    .faces .dot + .dot { margin-left: -8px; }
    .summary-text { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; }
    .summary-text.bad { color: var(--ion-color-danger); }
    .edit { flex: none; font-size: 13px; font-weight: 600; color: var(--ion-color-primary); }
    .editor { display: flex; flex-direction: column; gap: 10px; }
    .modes { display: inline-flex; align-self: flex-start; padding: 3px; border-radius: 10px; background: var(--ion-background-color, #fff); border: 1px solid var(--wl-field-border); }
    .modes button { padding: 5px 12px; border: 0; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 600; color: var(--wl-muted); background: none; cursor: pointer; }
    .modes button.selected { color: #fff; background: var(--ion-color-primary); }
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
    .status { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13px; font-weight: 600; color: var(--ion-color-danger); }
    .status.ok { color: var(--wl-type-ingreso); }
  `,
})
export class GroupSplitComponent {
  readonly members = input<readonly GroupMember[]>([]);
  readonly amount = input<number | null>(null);
  readonly meId = input('');
  /** El grupo divide gastos (false = bolsa común): cambia el texto de ayuda. */
  readonly splitsByDefault = input(true);
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
  /** Se abre solo si la división no es la de siempre (todos en partes iguales) o si está mal. */
  readonly editing = linkedSignal({
    source: () => this.members().length,
    computation: () => untracked(() => this.isCustom(this.division())),
  });

  readonly switchHint = computed(() => {
    if (this.division()) return this.i18n.t('splitOnHint');
    return this.i18n.t(this.splitsByDefault() ? 'splitOffHint' : 'splitSharedHint');
  });

  readonly includedPeople = computed(() => {
    const division = this.division();
    if (!division) return [];
    const ids = division.tipo === 'iguales' ? division.entre : Object.keys(division.partes).filter((id) => division.partes[id] > 0);
    return this.people().filter((p) => ids.includes(p.userId));
  });

  readonly summaryText = computed(() => {
    const division = this.division();
    if (!division) return '';
    if (division.tipo === 'montos') return this.valid() ? this.i18n.t('splitByAmounts') : this.statusText();
    const count = division.entre.length;
    if (!count) return this.i18n.t('splitPickSomeone');
    const each = (this.amount() ?? 0) / count;
    const money = `${this.preferences.currencyInfo().symbol}${each.toLocaleString(this.preferences.locale(), { maximumFractionDigits: 2 })}`;
    if (count === this.members().length) return this.i18n.t('splitAllEqual', String(count), money);
    const labels = this.includedPeople().map((p) => (p.userId === this.meId() ? this.i18n.t('you') : p.label));
    const names = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} ${this.i18n.t('and')} ${labels.at(-1)}` : labels[0];
    return count === 1 ? this.i18n.t('splitOnlyOne', names) : this.i18n.t('splitSomeEqual', names, money);
  });
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

  toggleSplit(): void {
    this.division.set(this.division() ? null : this.defaults());
  }

  private isCustom(division: Division | null): boolean {
    if (!division) return false;
    if (division.tipo === 'montos') return true;
    return division.entre.length !== this.members().length || division.entre.length === 0;
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
