import { Component, computed, inject, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmark, chevronForward } from 'ionicons/icons';
import { TranslatePipe, TranslationKey } from '../core/i18n/i18n';
import { ProfileStore } from '../core/profile-store';
import { BudgetsStore } from '../budgets/budgets-store';
import { MovementsStore } from '../movements/movements-store';
import { RecurringStore } from '../movements/recurring-store';

export type StepAction = 'expense' | 'income' | 'fixed';

interface Step {
  id: string;
  emoji: string;
  title: TranslationKey;
  hint: TranslationKey;
  done: boolean;
  /** Abre algo en Inicio (lo maneja la página) o navega. */
  action?: StepAction;
  link?: string;
}

/** Los pasos y si ya están hechos. Lo usa el componente y la página (para saber cuándo dejar de mostrarlo). */
export function injectGettingStarted() {
  const movements = inject(MovementsStore);
  const budgets = inject(BudgetsStore);
  const recurring = inject(RecurringStore);
  const profile = inject(ProfileStore);
  return computed<Step[]>(() => {
    const summary = movements.summary();
    const payout = profile.payout();
    return [
      { id: 'expense', emoji: '🧾', title: 'stepExpense', hint: 'stepExpenseHint', done: summary.gastos > 0, action: 'expense' },
      { id: 'income', emoji: '💰', title: 'stepIncome', hint: 'stepIncomeHint', done: summary.ingresos > 0, action: 'income' },
      { id: 'fixed', emoji: '🔁', title: 'stepFixed', hint: 'stepFixedHint', done: recurring.list().length > 0, action: 'fixed' },
      { id: 'budget', emoji: '🎯', title: 'stepBudget', hint: 'stepBudgetHint', done: budgets.progress().length > 0, link: '/presupuestos' },
      { id: 'payout', emoji: '💸', title: 'stepPayout', hint: 'stepPayoutHint', done: !!(payout.alias || payout.cuenta), link: '/cuenta' },
    ];
  });
}

/**
 * Primeros pasos: lo que se muestra en lugar del gráfico de evolución mientras no hay meses anteriores
 * con gastos (un gráfico vacío no ayuda). Cada paso se tilda solo cuando ya está hecho.
 */
@Component({
  selector: 'app-getting-started',
  imports: [IonIcon, NgTemplateOutlet, RouterLink, TranslatePipe],
  template: `
    <div class="progress" role="progressbar" [attr.aria-valuenow]="doneCount()" aria-valuemin="0" [attr.aria-valuemax]="steps().length">
      <span class="bar"><span [style.width.%]="(doneCount() / steps().length) * 100"></span></span>
      <span class="count">{{ 'stepsDone' | t: '' + doneCount() : '' + steps().length }}</span>
    </div>
    <ol>
      @for (step of steps(); track step.id) {
        <li [class.done]="step.done">
          @if (step.link) {
            <a class="step" [routerLink]="step.link">
              <ng-container [ngTemplateOutlet]="content" [ngTemplateOutletContext]="{ $implicit: step }" />
            </a>
          } @else {
            <button type="button" class="step" (click)="act.emit(step.action!)">
              <ng-container [ngTemplateOutlet]="content" [ngTemplateOutletContext]="{ $implicit: step }" />
            </button>
          }
        </li>
      }
    </ol>

    <ng-template #content let-step>
      <span class="check" aria-hidden="true">
        @if (step.done) {
          <ion-icon name="checkmark" />
        } @else {
          {{ step.emoji }}
        }
      </span>
      <span class="text">
        <strong>{{ step.title | t }}</strong>
        <span>{{ step.hint | t }}</span>
      </span>
      @if (!step.done) {
        <ion-icon class="go" name="chevron-forward" aria-hidden="true" />
      }
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .progress { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .bar { flex: 1; height: 6px; border-radius: 999px; background: var(--wl-field-bg); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: inherit; background: var(--ion-color-primary); transition: width 0.3s ease; }
    .count { font-size: 13px; font-weight: 600; color: var(--wl-muted); white-space: nowrap; }
    ol { list-style: none; margin: 0; padding: 0; }
    li + li { border-top: 1px solid var(--wl-field-border); }
    .step {
      display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 4px;
      font: inherit; text-align: left; color: inherit; text-decoration: none; background: none; border: 0; cursor: pointer;
      border-radius: 10px;
    }
    .step:hover { background: var(--wl-field-bg); }
    .check {
      flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%;
      font-size: 17px; background: var(--wl-field-bg); border: 1px solid var(--wl-field-border);
    }
    .done .check { font-size: 18px; color: var(--ion-color-primary-contrast); background: var(--ion-color-primary); border-color: var(--ion-color-primary); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .text strong { font-size: 15px; }
    .text span { font-size: 13px; color: var(--wl-muted); }
    .done .text strong { color: var(--wl-muted); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--wl-muted) 60%, transparent); }
    .go { flex: none; font-size: 18px; color: var(--wl-muted); }
  `,
})
export class GettingStartedComponent {
  readonly act = output<StepAction>();
  readonly steps = injectGettingStarted();

  readonly doneCount = computed(() => this.steps().filter((s) => s.done).length);

  constructor() {
    addIcons({ checkmark, chevronForward });
  }
}
