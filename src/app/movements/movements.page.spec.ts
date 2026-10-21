import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { MovementsPage } from './movements.page';
import { MovementsStore } from './movements-store';
import { monthRange } from '../core/dates';
import { summarize } from './movement.model';
import type { Movimiento } from '../core/database.types';

const mov = (id: string, tipo: Movimiento['tipo']): Movimiento => ({
  id, group_id: null, user_id: 'u', amount: 100, category: 'Otros', description: id,
  date: '2026-10-15', is_private: false, receipt_url: null, created_at: '', tipo, fuente: null,
});

describe('MovementsPage', () => {
  it('filtra por tipo y cuenta cada uno', () => {
    const list = signal([mov('a', 'gasto'), mov('b', 'gasto'), mov('c', 'ingreso')]);
    TestBed.configureTestingModule({
      providers: [{
        provide: MovementsStore,
        useValue: {
          range: signal(monthRange(0)), list, summary: computed(() => summarize(list())),
          movements: { error: signal(undefined), isLoading: signal(false), hasValue: signal(true), reload: vi.fn() },
          previousMonth: vi.fn(), nextMonth: vi.fn(),
        },
      }],
    });
    const page = TestBed.createComponent(MovementsPage).componentInstance;
    expect(page.filtered().length).toBe(3);
    expect(page.filterOptions()[1].label).toBe('Gastos · 2');
    page.filter.set('ingreso');
    expect(page.filtered().map((m) => m.id)).toEqual(['c']);
  });
});
