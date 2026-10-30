import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthStore } from '../core/auth-store';
import { Supabase } from '../core/supabase';
import { GroupsStore, PERSONAL } from './groups-store';

type Result = { data: unknown; error: null };

function query(result: Result) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'gte', 'lte', 'insert', 'delete', 'update', 'limit', 'single']) {
    chain[method] = () => chain;
  }
  chain['then'] = (resolve: (r: Result) => unknown) => resolve(result);
  return chain;
}

const group = { id: 'g1', name: 'Casa', currency: 'ARS', created_by: 'u1', invite_code: 'ab12', created_at: '' };

function setup() {
  const tables: Record<string, Result> = {
    group_members: { data: [{ group_id: 'g1', role: 'admin', joined_at: '' }], error: null },
    groups: { data: [group], error: null },
    expenses: { data: [{ group_id: 'g1', amount: 100, tipo: 'gasto' }], error: null },
  };
  const client = {
    from: (table: string) => query(tables[table]),
    rpc: () => Promise.resolve({ data: [{ user_id: 'u1', name: 'Ana', email: 'ana@mail.com', avatar_url: null, role: 'admin', joined_at: '' }], error: null }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => Promise.resolve(),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: Supabase, useValue: { client } },
      { provide: AuthStore, useValue: { user: signal({ id: 'u1' }) } },
    ],
  });
  return TestBed.inject(GroupsStore);
}

describe('GroupsStore', () => {
  beforeEach(() => localStorage.clear());

  it('carga los grupos con su rol y el resumen del mes', async () => {
    const store = setup();
    await vi.waitFor(() => expect(store.list().length).toBe(1));
    expect(store.list()[0]).toMatchObject({ group: { name: 'Casa' }, role: 'admin' });
    await vi.waitFor(() => expect(store.summaries.hasValue()).toBe(true));
    expect(store.summaries.value()?.['g1']).toEqual({ gastos: 100, ingresos: 0, count: 1 });
  });

  it('cambia de espacio y lo recuerda', async () => {
    const store = setup();
    await vi.waitFor(() => expect(store.list().length).toBe(1));
    store.setContext('g1');
    expect(store.activeGroupId()).toBe('g1');
    TestBed.tick();
    expect(localStorage.getItem('wallit_contexto')).toBe('g1');
  });

  it('vuelve a Personal si el grupo guardado ya no existe', async () => {
    localStorage.setItem('wallit_contexto', 'borrado');
    const store = setup();
    await vi.waitFor(() => expect(store.groups.hasValue()).toBe(true));
    expect(store.contextId()).toBe(PERSONAL);
    expect(store.activeGroupId()).toBeNull();
  });
});
