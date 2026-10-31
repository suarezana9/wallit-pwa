import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomePage } from './home.page';
import { ProfileStore } from '../core/profile-store';
import { MovementsStore } from '../movements/movements-store';
import { InsightsStore } from '../movements/insights-store';
import { GroupsStore } from '../groups/groups-store';
import { AuthStore } from '../core/auth-store';
import { BudgetsStore } from '../budgets/budgets-store';
import { monthRange } from '../core/dates';
import { summarize } from '../movements/movement.model';
import type { Movimiento } from '../core/database.types';

const mov = (id: string, tipo: Movimiento['tipo'], amount: number, description: string): Movimiento => ({
  id, group_id: null, user_id: 'u', amount, category: 'Supermercado', description,
  date: '2026-10-15', is_private: false, receipt_url: null, created_at: '', tipo, fuente: null, paid_by: null, division: null, detalle: null, medio_pago: null, compra_id: null, cuota_num: null, cuotas_total: null, recurrente_id: null,
});

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  const list = signal<Movimiento[]>([mov('1', 'gasto', 45000, 'Compra semanal'), mov('2', 'ingreso', 100000, 'Sueldo')]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { user: signal({ id: 'u' }) } },
        { provide: BudgetsStore, useValue: { progress: signal([]) } },
        {
          provide: GroupsStore,
          useValue: {
            list: signal([]),
            active: signal(null),
            contextId: signal('personal'),
            activeGroupId: signal(null),
            memberNames: signal({}),
            setContext: vi.fn(),
          },
        },
        { provide: ProfileStore, useValue: { displayName: signal('Ana') } },
        {
          provide: MovementsStore,
          useValue: {
            range: signal(monthRange(0)),
            monthOffset: signal(0),
            goToCurrentMonth: vi.fn(),
            label: signal('Octubre 2026'),
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
