import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomePage } from './home.page';
import { ProfileStore } from '../core/profile-store';
import { MovementsStore } from '../movements/movements-store';
import { InsightsStore } from '../movements/insights-store';
import { monthRange } from '../core/dates';
import { summarize } from '../movements/movement.model';
import type { Movimiento } from '../core/database.types';

const mov = (id: string, tipo: Movimiento['tipo'], amount: number, description: string): Movimiento => ({
  id, group_id: null, user_id: 'u', amount, category: 'Supermercado', description,
  date: '2026-10-15', is_private: false, receipt_url: null, created_at: '', tipo, fuente: null,
});

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  const list = signal<Movimiento[]>([mov('1', 'gasto', 45000, 'Compra semanal'), mov('2', 'ingreso', 100000, 'Sueldo')]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProfileStore, useValue: { displayName: signal('Ana') } },
        {
          provide: MovementsStore,
          useValue: {
            range: signal(monthRange(0)),
            list,
            summary: computed(() => summarize(list())),
            movements: { error: signal(undefined), isLoading: signal(false), hasValue: signal(true), reload: vi.fn() },
            previousMonth: vi.fn(),
            nextMonth: vi.fn(),
          },
        },
        {
          provide: InsightsStore,
          useValue: {
            months: signal([]),
            expenseChange: signal({ percent: 12.4, previousMonth: 'septiembre' }),
            reload: vi.fn(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
  });

  it('muestra el disponible, la comparación y los últimos movimientos', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Hola, Ana');
    expect(text).toContain('Disponible');
    expect(text).toContain('12% vs septiembre');
    expect(text).toContain('Compra semanal');
  });
});
