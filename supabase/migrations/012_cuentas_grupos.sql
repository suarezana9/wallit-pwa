-- 012: cuentas claras en grupos (quién pagó, cómo se divide y pagos entre miembros).
-- Correr una vez en Supabase > SQL Editor. Es idempotente: se puede volver a correr sin romper nada.

-- 1) Quién pagó. NULL = lo pagó quien lo cargó (user_id), así los movimientos viejos siguen igual.
alter table public.expenses
  add column if not exists paid_by uuid references public.users(id) on delete set null;

-- 2) Cómo se divide un gasto de grupo. NULL = no se divide (movimientos personales y gastos viejos).
--    {"tipo": "iguales", "entre": ["<uid>", ...]}
--    {"tipo": "montos",  "partes": {"<uid>": 1200.5, ...}}
alter table public.expenses
  add column if not exists division jsonb;

alter table public.expenses drop constraint if exists expenses_division_check;
alter table public.expenses add constraint expenses_division_check check (
  division is null
  or (division->>'tipo' = 'iguales' and jsonb_typeof(division->'entre') = 'array')
  or (division->>'tipo' = 'montos' and jsonb_typeof(division->'partes') = 'object')
);

-- Quien pagó tiene que ser miembro del grupo del gasto (o quien lo carga).
create or replace function public.es_miembro(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id);
$$;

drop policy if exists "gastos_insert" on public.expenses;
create policy "gastos_insert" on public.expenses
  for insert with check (
    user_id = (select auth.uid())
    and (
      (group_id is null and paid_by is null)
      or (
        group_id is not null
        and public.es_miembro(group_id, (select auth.uid()))
        and (paid_by is null or public.es_miembro(group_id, paid_by))
      )
    )
  );

drop policy if exists "gastos_update" on public.expenses;
create policy "gastos_update" on public.expenses
  for update
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (paid_by is null or (group_id is not null and public.es_miembro(group_id, paid_by)))
  );

-- 3) Pagos entre miembros para saldar cuentas ("Ana le pagó $12.400 a Luigi").
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user uuid not null references public.users(id) on delete cascade,
  to_user uuid not null references public.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  date date not null default current_date,
  created_by uuid not null references public.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create index if not exists settlements_group_idx on public.settlements (group_id, date desc);

alter table public.settlements enable row level security;

drop policy if exists "pagos_select" on public.settlements;
create policy "pagos_select" on public.settlements
  for select using (public.es_miembro(group_id, (select auth.uid())));

-- Lo registra alguien del grupo, entre dos miembros del grupo, y quien lo registra es una de las dos partes.
drop policy if exists "pagos_insert" on public.settlements;
create policy "pagos_insert" on public.settlements
  for insert with check (
    created_by = (select auth.uid())
    and (select auth.uid()) in (from_user, to_user)
    and public.es_miembro(group_id, from_user)
    and public.es_miembro(group_id, to_user)
  );

drop policy if exists "pagos_delete" on public.settlements;
create policy "pagos_delete" on public.settlements
  for delete using (created_by = (select auth.uid()));

-- 4) Tiempo real: que los saldos se actualicen solos cuando alguien registra un pago.
do $$
begin
  alter publication supabase_realtime add table public.settlements;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
