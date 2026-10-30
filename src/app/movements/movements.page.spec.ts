import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MovementsPage } from './movements.page';
import { GroupsStore } from '../groups/groups-store';
import { AuthStore } from '../core/auth-store';
import { Supabase } from '../core/supabase';

describe('MovementsPage', () => {
  it('usa el espacio activo para el explorador', () => {
    const query: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'gte', 'lte', 'order', 'limit']) query[m] = () => query;
    query['then'] = (resolve: (r: unknown) => unknown) => resolve({ data: [], error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: Supabase, useValue: { client: { from: () => query, channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: () => Promise.resolve() } } },
        { provide: AuthStore, useValue: { user: signal({ id: 'u' }) } },
        {
          provide: GroupsStore,
          useValue: {
            list: signal([]), active: signal(null), contextId: signal('personal'), activeGroupId: signal(null),
            memberNames: signal({}), activeMembers: { hasValue: () => false, value: () => [] },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MovementsPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.groupId()).toBeNull();
    expect(fixture.componentInstance.fileName()).toBe('wallit-personal');
  });
});
