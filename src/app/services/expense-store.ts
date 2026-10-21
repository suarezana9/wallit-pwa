import { Service, computed, signal } from '@angular/core';
import { Expense } from '../models/expense.model.ts/expense.model';

@Service()
export class ExpenseStore {
  private readonly _expenses = signal<Expense[]>([ { id: '1', amount: 45000, category: 'Supermercado', date: '2026-10-15T12:00:00' },
    { id: '2', amount: 18000, category: 'Transporte',   date: '2026-10-16T12:00:00' },
    { id: '3', amount: 32000, category: 'Servicios',    date: '2026-10-17T12:00:00' },
    { id: '4', amount: 12500, category: 'Farmacia',     date: '2026-10-18T12:00:00' }, ]);
  readonly expenses = this._expenses.asReadonly();
  readonly total = computed(() => this._expenses().reduce((sum, e) => sum + e.amount, 0));
  
}